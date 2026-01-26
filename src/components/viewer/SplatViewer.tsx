import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SplatViewer as SplatViewerLib, SceneFormat } from '../../lib/splatRenderer';
import type { SmoothedHeadPosition } from '../../hooks/useHeadTracking';
import { LoadingOverlay } from './LoadingOverlay';
import { ErrorOverlay } from './ErrorOverlay';

/**
 * Head Tracking Parameters for the "Window into Virtual World" Effect
 *
 * The screen acts as a virtual window into a 3D scene. As your head moves,
 * the perspective shifts using off-axis projection, creating a parallax effect.
 */
export interface HeadTrackingParams {
    // === Core Parameters ===
    /** Base distance from viewer to virtual screen (scene units). Default: 60 */
    distance: number;
    /** Movement multiplier. 1.0 = 1:1 mapping, <1 = subtle, >1 = exaggerated. Default: 1.0 */
    sensitivity: number;
    /** Virtual screen size for frustum calculation. Default: 30 */
    screenSize: number;
    /** Vertical offset to compensate for webcam above screen center. Default: 0.15 */
    verticalOffset: number;

    // === Camera Position Offsets ===
    /** Manual X offset for scene centering. Default: 0 */
    cameraX: number;
    /** Manual Y offset for scene centering. Default: 0 */
    cameraY: number;
    /** Manual Z offset for scene centering. Default: 0 */
    cameraZ: number;

    // === Focus ===
    /** Z coordinate where the "screen plane" sits (objects here appear pinned). Default: 0 */
    focusDepth: number;

    // === Depth Tracking ===
    /** How much Z movement (toward/away) affects view. 0 = disabled. Default: 0.5 */
    depthSensitivity: number;

    // === Smoothing (passed to useHeadTracking) ===
    /** Exponential smoothing factor. Lower = smoother but more latency. Default: 0.15 */
    smoothing: number;
    /** Dead zone threshold to ignore micro-jitter. Default: 0.005 */
    deadZone: number;

    // === Axis Toggles ===
    /** Enable X-axis (left/right) tracking. Default: true */
    enableX: boolean;
    /** Enable Y-axis (up/down) tracking. Default: true */
    enableY: boolean;
    /** Enable Z-axis (depth/zoom) tracking. Default: true */
    enableZ: boolean;

    // === Axis Inversion ===
    /** Invert X-axis direction. Default: false */
    invertX: boolean;
    /** Invert Y-axis direction. Default: false */
    invertY: boolean;
    /** Invert Z-axis direction. Default: false */
    invertZ: boolean;
}

interface SplatViewerProps {
    url: string;
    format: 'ply' | 'splat' | null;
    headPosition: React.MutableRefObject<SmoothedHeadPosition>;
    controlMode: 'head' | 'orbit';
    headTrackingParams?: HeadTrackingParams;
    onError?: (error: string) => void;
    onLoaded?: () => void;
}

/**
 * Default parameters tuned for natural "looking around the corner" experience.
 * Move your head to peek around the scene as if looking through a window.
 *
 * These values are calibrated based on extensive user testing.
 */
export const DEFAULT_HEAD_TRACKING_PARAMS: HeadTrackingParams = {
    // Core - tuned for camera translation approach
    distance: 2.5,           // Not used in new approach but kept for compatibility
    sensitivity: 0.5,        // How much the camera moves relative to head movement
    screenSize: 0.5,         // Not used in new approach but kept for compatibility
    verticalOffset: 0,       // Not used in new approach

    // Camera offsets - added to head tracking movement
    cameraX: 0,              // Additional X offset (manual adjustment)
    cameraY: 0,              // Additional Y offset (manual adjustment)
    cameraZ: 0,              // Additional Z offset (manual adjustment)

    // Focus
    focusDepth: 0,           // Not used in new approach but kept for compatibility

    // Depth tracking
    depthSensitivity: 0.3,   // How much lean in/out affects zoom

    // Smoothing
    smoothing: 0.15,         // Lower = smoother but more latency
    deadZone: 0.005,         // Ignore small jitter

    // Axis toggles - all enabled by default
    enableX: true,           // Left/right tracking
    enableY: true,           // Up/down tracking
    enableZ: true,           // Depth/zoom tracking

    // Axis inversion - calibrated for natural movement
    invertX: false,          // Move head left -> camera moves left -> see right side
    invertY: false,          // Move head up -> camera moves up -> see bottom
    invertZ: false,          // Move closer -> camera moves closer -> zoom in
};

export function SplatViewer({ url, format, headPosition, controlMode, headTrackingParams, onError, onLoaded }: SplatViewerProps) {
    const params = headTrackingParams ?? DEFAULT_HEAD_TRACKING_PARAMS;
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<SplatViewerLib | null>(null);
    const animationRef = useRef<number | null>(null);
    // Track latest params in ref to avoid stale closures in RAF callback
    const paramsRef = useRef(params);
    paramsRef.current = params;  // Always keep ref in sync with latest params
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loadProgress, setLoadProgress] = useState(0);
    // Debug stats (uncomment if needed for debugging)
    // const [debugStats, setDebugStats] = useState({
    //     splatCount: 0,
    //     cameraPos: { x: 0, y: 0, z: 0 },
    //     cameraRot: { x: 0, y: 0, z: 0 },
    //     isRenderLoopActive: false,
    //     controlsEnabled: false
    // });

    // Initialize viewer and load scene
    useEffect(() => {
        if (!containerRef.current) {
            console.error('[SplatWindow] Container ref is null!');
            onError?.('Viewer container not mounted');
            return;
        }

        let isActive = true;

        if (import.meta.env.DEV) {
            console.log('[SplatWindow] Initializing viewer...');
            console.log('[SplatWindow] URL:', url);
            console.log('[SplatWindow] Format:', format);
        }

        // Clean up previous viewer
        if (viewerRef.current) {
            if (import.meta.env.DEV) console.log('[SplatWindow] Disposing previous viewer');
            try {
                viewerRef.current.dispose();
            } catch (e) {
                console.warn('[SplatWindow] Error disposing viewer:', e);
            }
            viewerRef.current = null;
        }

        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        // Clear the container
        containerRef.current.innerHTML = '';

        setLoadError(null);
        setLoading(true);
        setLoadProgress(10);

        try {
            // Calculate initial camera position from params
            // When head position is (0,0,0), camera should be at:
            // z = distance + cameraZ (looking toward focusDepth)
            const initialCamZ = params.distance + params.cameraZ;
            const initialCamY = params.verticalOffset * params.screenSize + params.cameraY;
            const initialCamX = params.cameraX;

            const viewer = new SplatViewerLib({
                rootElement: containerRef.current,
                cameraUp: [0, 1, 0],
                initialCameraPosition: [initialCamX, initialCamY, initialCamZ],
                initialCameraLookAt: [params.cameraX, params.cameraY, params.focusDepth],
                useBuiltInControls: true,
                antialiased: false, // Better performance with Spark
            });

            viewerRef.current = viewer;
            if (import.meta.env.DEV) console.log('[SplatWindow] Viewer created successfully');

            // Determine scene format (kept for reference, Spark auto-detects)
            let sceneFormat: number | undefined;
            if (format === 'ply') {
                sceneFormat = SceneFormat.Ply;
            } else if (format === 'splat') {
                sceneFormat = SceneFormat.Splat;
            }

            // PLY files from SHARP need rotation fix (OpenCV -> Three.js coordinates)
            const needsRotation = format === 'ply';

            setLoadProgress(30);

            const sceneOptions: { format?: number; rotation?: [number, number, number, number]; showLoadingUI?: boolean } = {
                showLoadingUI: false,
            };

            if (sceneFormat !== undefined) {
                sceneOptions.format = sceneFormat;
            }

            if (needsRotation) {
                // Rotate 180° around X-axis: quaternion [sin(90°), 0, 0, cos(90°)] = [1, 0, 0, 0]
                sceneOptions.rotation = [1, 0, 0, 0];
                if (import.meta.env.DEV) console.log('[SplatWindow] Applying rotation for PLY format (quaternion: [1, 0, 0, 0])');
            }

            if (import.meta.env.DEV) console.log('[SplatWindow] Adding splat scene with options:', sceneOptions);

            viewer.addSplatScene(url, sceneOptions)
                .then(() => {
                    if (!isActive) {
                        if (import.meta.env.DEV) console.log('[SplatWindow] Effect cleaned up, ignoring scene load');
                        return;
                    }

                    if (import.meta.env.DEV) console.log('[SplatWindow] Scene loaded successfully');

                    // Log splat count (only in dev)
                    const splatCount = viewer.getSplatCount();
                    if (import.meta.env.DEV) console.log('[SplatWindow] Splat count:', splatCount);

                    setLoadProgress(80);

                    try {
                        viewer.start();
                        if (import.meta.env.DEV) console.log('[SplatWindow] Viewer started');
                    } catch (startErr) {
                        console.error('[SplatWindow] Error starting viewer:', startErr);
                        throw startErr;
                    }

                    // Verify canvas was created (only in dev mode)
                    if (import.meta.env.DEV) {
                        setTimeout(() => {
                            const container = containerRef.current;
                            const canvas = container?.querySelector('canvas');
                            console.log('[SplatWindow] Container dimensions:', {
                                width: container?.clientWidth,
                                height: container?.clientHeight,
                                offsetWidth: container?.offsetWidth,
                                offsetHeight: container?.offsetHeight,
                            });
                            if (!canvas) {
                                console.error('[SplatWindow] Canvas not found after viewer start!');
                                console.log('[SplatWindow] Container children:', container?.children);
                            } else {
                                console.log('[SplatWindow] Canvas verified:', canvas.width, 'x', canvas.height);
                                console.log('[SplatWindow] Canvas style:', {
                                    position: canvas.style.position,
                                    zIndex: canvas.style.zIndex,
                                    width: canvas.style.width,
                                    height: canvas.style.height,
                                });
                            }
                        }, 100);
                    }

                    // Auto-fit camera to scene bounds using SplatMesh bounding box
                    setTimeout(() => {
                        if (!viewer.camera || !viewer.splatMesh) return;

                        // Get bounding box from SplatMesh
                        const box = viewer.splatMesh.getBoundingBox();
                        box.applyMatrix4(viewer.splatMesh.matrixWorld);

                        const center = box.getCenter(new THREE.Vector3());
                        const size = box.getSize(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z);

                        if (import.meta.env.DEV) console.log('[SplatWindow] Scene bounds:', { center, size, maxDim });

                        if (maxDim > 0 && isFinite(maxDim)) {
                            const distance = maxDim * 1.5;
                            const camera = viewer.camera;

                            camera.position.set(center.x, center.y, center.z + distance);
                            camera.lookAt(center);
                            camera.updateMatrixWorld(true);

                            if (viewer.controls?.target) {
                                viewer.controls.target.copy(center);
                                viewer.controls.update();
                            }

                            if (import.meta.env.DEV) console.log('[SplatWindow] Camera repositioned to:', camera.position, 'looking at:', center);
                        }

                        // Configure orbit controls sensitivity (lower = less sensitive)
                        if (viewer.controls) {
                            viewer.controls.rotateSpeed = 0.3;
                            viewer.controls.panSpeed = 0.3;
                            viewer.controls.zoomSpeed = 0.5;
                            if (import.meta.env.DEV) console.log('[SplatWindow] Orbit controls sensitivity reduced');
                        }
                    }, 200);

                    setLoadProgress(100);
                    setLoading(false);
                    onLoaded?.();
                })
                .catch((err: Error) => {
                    console.error('[SplatWindow] Catch block received:', err.message, err);

                    if (!isActive) return;

                    if (err.message?.includes('disposed') || err.message?.includes('abort')) {
                        if (import.meta.env.DEV) console.log('[SplatWindow] Scene load aborted (cleanup)');
                        return;
                    }

                    console.error('[SplatWindow] Failed to load scene:', err);
                    const errorMsg = `Failed to load: ${err.message}`;
                    setLoadError(errorMsg);
                    setLoading(false);
                    onError?.(errorMsg);
                });

        } catch (err) {
            console.error('[SplatWindow] Error creating viewer:', err);
            const errorMsg = `Viewer initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
            setLoadError(errorMsg);
            setLoading(false);
            onError?.(errorMsg);
        }

        return () => {
            if (import.meta.env.DEV) console.log('[SplatWindow] Cleanup: disposing viewer');
            isActive = false;

            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }

            if (viewerRef.current) {
                try {
                    viewerRef.current.dispose();
                } catch (e) {
                    console.warn('[SplatWindow] Error during cleanup:', e);
                }
                viewerRef.current = null;
            }
        };
    }, [url, format]);

    // Store last orbit camera position to restore when switching back
    const lastOrbitCameraRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

    // Toggle controls based on mode - preserve camera position between modes
    useEffect(() => {
        if (!viewerRef.current || loading) return;

        const viewer = viewerRef.current;

        if (viewer.controls && viewer.camera) {
            if (controlMode === 'orbit') {
                // Switching TO orbit mode
                viewer.controls.enabled = true;

                // Restore saved orbit position if we have one
                if (lastOrbitCameraRef.current) {
                    viewer.camera.position.copy(lastOrbitCameraRef.current.position);
                    if (viewer.controls.target) {
                        viewer.controls.target.copy(lastOrbitCameraRef.current.target);
                    }
                    viewer.camera.lookAt(lastOrbitCameraRef.current.target);
                }
                viewer.camera.updateMatrixWorld(true);
                viewer.controls.update();
                if (import.meta.env.DEV) console.log('[SplatWindow] Enabled orbit controls');
            } else {
                // Switching TO head tracking mode
                // Save current orbit camera position so we can use it as base for head tracking
                const pos = viewer.camera.position;
                const target = viewer.controls.target || new THREE.Vector3(0, 0, 0);
                lastOrbitCameraRef.current = {
                    position: pos.clone(),
                    target: target.clone(),
                };

                viewer.controls.enabled = false;
                if (import.meta.env.DEV) console.log('[SplatWindow] Disabled orbit controls, head tracking base:', pos.toArray());
            }
        }
    }, [controlMode, loading]);

    // Store base camera position from orbit mode (set when switching to head tracking)
    const baseCameraRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

    // Head tracking camera updates with actual camera translation
    useEffect(() => {
        // Cancel any existing RAF to prevent memory leak
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        if (!viewerRef.current || loading) return;

        // Only run in head tracking mode
        if (controlMode !== 'head') return;

        const viewer = viewerRef.current;

        // Capture the current camera position as the "home" base for head tracking
        if (!baseCameraRef.current && viewer.camera) {
            baseCameraRef.current = {
                position: viewer.camera.position.clone(),
                target: viewer.controls?.target?.clone() || new THREE.Vector3(0, 0, 0),
            };
            if (import.meta.env.DEV) console.log('[SplatWindow] Set head tracking base:', baseCameraRef.current.position.toArray());
        }

        if (import.meta.env.DEV) console.log('[SplatWindow] Starting head tracking camera loop');

        /**
         * Camera Translation Implementation - "Looking Around the Corner" Effect
         *
         * Instead of off-axis projection, we use simple camera translation:
         * 1. Keep looking at a fixed focal point (the scene center)
         * 2. Move the camera position based on head movement
         * 3. This creates the illusion of "peeking around" the scene
         *
         * Movement mapping:
         *   - Head moves left -> Camera moves left -> See more of the right side
         *   - Head moves up -> Camera moves up -> See more of the bottom
         *   - Head moves closer -> Camera moves closer -> Zoom in effect
         */
        const updateCamera = () => {
            if (!viewerRef.current || !baseCameraRef.current) {
                animationRef.current = requestAnimationFrame(updateCamera);
                return;
            }

            const camera = viewerRef.current.camera;
            if (!camera || !containerRef.current) {
                animationRef.current = requestAnimationFrame(updateCamera);
                return;
            }

            // Get smoothed head position (-1 to 1 range)
            const hp = headPosition.current;

            // Extract params from ref to avoid stale closure
            const {
                sensitivity,
                cameraX,
                cameraY,
                cameraZ,
                depthSensitivity,
                enableX,
                enableY,
                enableZ,
                invertX,
                invertY,
                invertZ
            } = paramsRef.current;

            // Base position from when we entered head tracking mode
            const base = baseCameraRef.current;

            // Calculate camera movement scale based on distance to target
            const distToTarget = base.position.distanceTo(base.target);
            const moveScale = distToTarget * sensitivity;

            // Apply axis toggles and inversions
            const xMult = (invertX ? -1 : 1) * (enableX ? 1 : 0);
            const yMult = (invertY ? -1 : 1) * (enableY ? 1 : 0);
            const zMult = (invertZ ? -1 : 1) * (enableZ ? 1 : 0);

            // Calculate camera offset from head position
            // Move in the same direction as head movement for "looking around" effect
            const xOffset = hp.smoothedX * moveScale * xMult + cameraX;
            const yOffset = hp.smoothedY * moveScale * yMult + cameraY;
            const zOffset = hp.smoothedZ * distToTarget * depthSensitivity * zMult + cameraZ;

            // New camera position = base position + offset
            const newPos = new THREE.Vector3(
                base.position.x + xOffset,
                base.position.y + yOffset,
                base.position.z - zOffset  // Negative because moving closer (positive Z) should decrease distance
            );

            // Clamp to reasonable bounds to prevent extreme positions
            const maxOffset = distToTarget * 2;
            newPos.x = Math.max(base.position.x - maxOffset, Math.min(base.position.x + maxOffset, newPos.x));
            newPos.y = Math.max(base.position.y - maxOffset, Math.min(base.position.y + maxOffset, newPos.y));
            newPos.z = Math.max(0.5, Math.min(base.position.z + maxOffset, newPos.z));

            // Apply position and look at target
            camera.position.copy(newPos);
            camera.lookAt(base.target);
            camera.updateMatrixWorld(true);

            animationRef.current = requestAnimationFrame(updateCamera);
        };

        animationRef.current = requestAnimationFrame(updateCamera);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            // Clear base camera when leaving head tracking mode
            baseCameraRef.current = null;
            if (import.meta.env.DEV) console.log('[SplatWindow] Stopped head tracking camera loop');
        };
    // Note: params removed from deps - we use paramsRef.current inside RAF for immediate updates
    }, [controlMode, loading, headPosition]);

    return (
        <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
            {/* Viewer container - the library will create a canvas inside */}
            <div
                ref={containerRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    width: '100%',
                    height: '100%',
                }}
            />

            {/* Loading overlay */}
            {loading && !loadError && <LoadingOverlay progress={loadProgress} />}

            {/* Error overlay */}
            {loadError && <ErrorOverlay message={loadError} />}
        </div>
    );
}
