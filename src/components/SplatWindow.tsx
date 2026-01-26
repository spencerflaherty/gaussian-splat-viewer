import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { SplatViewer, SceneFormat } from '../lib/splatRenderer';
import type { SmoothedHeadPosition } from '../hooks/useHeadTracking';

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

interface SplatWindowProps {
    url: string;
    format: 'ply' | 'splat' | null;
    headPosition: React.MutableRefObject<SmoothedHeadPosition>;
    controlMode: 'head' | 'orbit';
    headTrackingParams?: HeadTrackingParams;
    onError?: (error: string) => void;
    onLoaded?: () => void;
}

/**
 * Default parameters tuned for natural "window into a photo" experience.
 * The image should fill the screen and respond subtly to head movement.
 *
 * These values are calibrated based on extensive user testing.
 */
export const DEFAULT_HEAD_TRACKING_PARAMS: HeadTrackingParams = {
    // Core - tuned from user testing
    distance: 2.5,           // Viewing distance
    sensitivity: 0.2,        // Moderate parallax - feels natural
    screenSize: 0.5,         // Virtual screen size for frustum
    verticalOffset: 0.69,    // Webcam position compensation (calibrated)

    // Camera offsets (for scene centering)
    cameraX: 0,
    cameraY: 0,
    cameraZ: -2,

    // Focus
    focusDepth: 0,           // Scene origin at screen plane

    // Depth tracking
    depthSensitivity: 0.15,  // Subtle zoom on lean in/out

    // Smoothing
    smoothing: 0.26,         // Smooth movement
    deadZone: 0.008,         // Ignore small jitter

    // Axis toggles - all enabled by default
    enableX: true,           // Left/right tracking
    enableY: true,           // Up/down tracking
    enableZ: true,           // Depth/zoom tracking

    // Axis inversion - X and Y flipped by default (calibrated)
    invertX: true,
    invertY: true,
    invertZ: false,
};

export function SplatWindow({ url, format, headPosition, controlMode, headTrackingParams, onError, onLoaded }: SplatWindowProps) {
    const params = headTrackingParams ?? DEFAULT_HEAD_TRACKING_PARAMS;
    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<SplatViewer | null>(null);
    const animationRef = useRef<number | null>(null);
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

        console.log('[SplatWindow] Initializing viewer...');
        console.log('[SplatWindow] URL:', url);
        console.log('[SplatWindow] Format:', format);

        // Clean up previous viewer
        if (viewerRef.current) {
            console.log('[SplatWindow] Disposing previous viewer');
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

            const viewer = new SplatViewer({
                rootElement: containerRef.current,
                cameraUp: [0, 1, 0],
                initialCameraPosition: [initialCamX, initialCamY, initialCamZ],
                initialCameraLookAt: [params.cameraX, params.cameraY, params.focusDepth],
                useBuiltInControls: true,
                antialiased: false, // Better performance with Spark
            });

            viewerRef.current = viewer;
            console.log('[SplatWindow] Viewer created successfully');

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
                console.log('[SplatWindow] Applying rotation for PLY format (quaternion: [1, 0, 0, 0])');
            }

            console.log('[SplatWindow] Adding splat scene with options:', sceneOptions);

            viewer.addSplatScene(url, sceneOptions)
                .then(() => {
                    if (!isActive) {
                        console.log('[SplatWindow] Effect cleaned up, ignoring scene load');
                        return;
                    }

                    console.log('[SplatWindow] Scene loaded successfully');

                    // Log splat count
                    const splatCount = viewer.getSplatCount();
                    console.log('[SplatWindow] Splat count:', splatCount);

                    setLoadProgress(80);

                    try {
                        viewer.start();
                        console.log('[SplatWindow] Viewer started');
                    } catch (startErr) {
                        console.error('[SplatWindow] Error starting viewer:', startErr);
                        throw startErr;
                    }

                    // Verify canvas was created and debug container dimensions
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

                    // Auto-fit camera to scene bounds using SplatMesh bounding box
                    setTimeout(() => {
                        if (!viewer.camera || !viewer.splatMesh) return;

                        // Get bounding box from SplatMesh
                        const box = viewer.splatMesh.getBoundingBox();
                        box.applyMatrix4(viewer.splatMesh.matrixWorld);

                        const center = box.getCenter(new THREE.Vector3());
                        const size = box.getSize(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z);

                        console.log('[SplatWindow] Scene bounds:', { center, size, maxDim });

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

                            console.log('[SplatWindow] Camera repositioned to:', camera.position, 'looking at:', center);
                        }

                        // Configure orbit controls sensitivity (lower = less sensitive)
                        if (viewer.controls) {
                            viewer.controls.rotateSpeed = 0.3;
                            viewer.controls.panSpeed = 0.3;
                            viewer.controls.zoomSpeed = 0.5;
                            console.log('[SplatWindow] Orbit controls sensitivity reduced');
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
                        console.log('[SplatWindow] Scene load aborted (cleanup)');
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
            console.log('[SplatWindow] Cleanup: disposing viewer');
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

    // Debug loop (only in development)
    useEffect(() => {
        if (import.meta.env.PROD) return; // Skip debug loop in production

        let debugCounter = 0;
        const interval = setInterval(() => {
            if (!viewerRef.current) return;

            const viewer = viewerRef.current;
            const camera = viewer.camera;
            const count = viewer.getSplatCount();

            debugCounter++;
            if (debugCounter % 10 === 0) {
                console.log('[SplatWindow] Debug tick:', {
                    splatCount: count,
                    hasCamera: !!camera,
                    cameraPos: camera ? `${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}` : 'N/A'
                });
            }
        }, 500);

        return () => clearInterval(interval);
    }, []);

    // Toggle controls based on mode
    useEffect(() => {
        if (!viewerRef.current || loading) return;

        const viewer = viewerRef.current;

        if (viewer.controls) {
            viewer.controls.enabled = (controlMode === 'orbit');
            console.log(`[SplatWindow] Controls ${controlMode === 'orbit' ? 'enabled' : 'disabled'} for ${controlMode} mode`);

            // When switching to orbit mode, reset camera to a reasonable position
            if (controlMode === 'orbit' && viewer.camera) {
                const camZ = params.distance + params.cameraZ;
                const camY = params.verticalOffset * params.screenSize + params.cameraY;
                const camX = params.cameraX;
                viewer.camera.position.set(camX, camY, camZ);
                viewer.camera.lookAt(params.cameraX, params.cameraY, params.focusDepth);
                viewer.camera.updateMatrixWorld(true);
                console.log('[SplatWindow] Reset camera for orbit mode');
            }
        }
    }, [controlMode, loading, params]);

    // Head tracking camera updates with off-axis projection
    useEffect(() => {
        // Cancel any existing RAF to prevent memory leak
        if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
        }

        if (!viewerRef.current || loading) return;

        // Only run in head tracking mode
        if (controlMode !== 'head') return;

        console.log('[SplatWindow] Starting head tracking camera loop');

        /**
         * Off-Axis Projection Implementation
         *
         * The key insight: your screen is a virtual window into a 3D scene.
         * As your head moves, we shift the camera frustum asymmetrically
         * to create the parallax effect.
         *
         * Eye position in screen-space:
         *   eyeX = headPos.x * sensitivity + cameraX
         *   eyeY = headPos.y * sensitivity + verticalOffset + cameraY
         *   eyeZ = distance + (headPos.z * depthSensitivity) + cameraZ
         *
         * Frustum boundaries:
         *   left   = (-screenWidth/2 - eyeX) * near / eyeZ
         *   right  = (screenWidth/2 - eyeX) * near / eyeZ
         *   bottom = (-screenHeight/2 - eyeY) * near / eyeZ
         *   top    = (screenHeight/2 - eyeY) * near / eyeZ
         */
        const updateCamera = () => {
            if (!viewerRef.current) return;

            const camera = viewerRef.current.camera;
            if (!camera || !containerRef.current) {
                animationRef.current = requestAnimationFrame(updateCamera);
                return;
            }

            // Get smoothed head position
            const hp = headPosition.current;

            // Extract params
            const {
                distance,
                sensitivity,
                screenSize,
                verticalOffset,
                cameraX,
                cameraY,
                cameraZ,
                focusDepth,
                depthSensitivity,
                enableX,
                enableY,
                enableZ,
                invertX,
                invertY,
                invertZ
            } = params;

            // Calculate eye position in screen-space coordinates
            // Use smoothed values for smooth camera movement
            // Each axis can be toggled on/off and inverted independently
            const xMult = invertX ? -1 : 1;
            const yMult = invertY ? 1 : -1; // Base Y is already negated, so invert flips it back
            const zMult = invertZ ? -1 : 1;

            const xOffset = enableX ? (hp.smoothedX * sensitivity * screenSize * xMult) : 0;
            const yOffset = enableY ? (hp.smoothedY * sensitivity * screenSize * yMult) : 0;

            const eyeX = xOffset + cameraX;
            const eyeY = yOffset + (verticalOffset * screenSize) + cameraY;

            // Depth: positive hp.z (closer to webcam) should zoom in (decrease distance)
            const depthOffset = enableZ ? (hp.smoothedZ * depthSensitivity * screenSize * zMult) : 0;
            const eyeZ = distance + cameraZ - depthOffset;

            // Validate eyeZ to prevent division by zero or negative values
            const safeEyeZ = Math.max(eyeZ, 0.5);

            // Calculate aspect ratio from container
            const containerWidth = containerRef.current.clientWidth;
            const containerHeight = containerRef.current.clientHeight;

            // Skip if container has no dimensions yet
            if (containerWidth === 0 || containerHeight === 0) {
                animationRef.current = requestAnimationFrame(updateCamera);
                return;
            }

            const aspect = containerWidth / containerHeight;

            // Virtual screen dimensions (the "window frame")
            const screenHeight = screenSize;
            const screenWidth = screenHeight * aspect;

            // Frustum boundaries
            const halfWidth = screenWidth / 2;
            const halfHeight = screenHeight / 2;

            // Near/far planes
            const near = 0.1;
            const far = 1000;

            // Distance from eye to the focus plane (where objects appear "pinned" to screen)
            const distToFocusPlane = Math.abs(safeEyeZ - focusDepth);
            const safeDist = Math.max(distToFocusPlane, 0.5);

            // Calculate off-axis frustum
            // Objects at focusDepth will appear pinned to the screen
            // Objects closer will appear to pop out, farther will appear behind
            const left = (-halfWidth - eyeX) * near / safeDist;
            const right = (halfWidth - eyeX) * near / safeDist;
            const bottom = (-halfHeight - eyeY) * near / safeDist;
            const top = (halfHeight - eyeY) * near / safeDist;

            // Validate projection parameters - all must be finite and create valid frustum
            if (!isFinite(left) || !isFinite(right) || !isFinite(bottom) || !isFinite(top) ||
                left >= right || bottom >= top) {
                // Skip this frame silently - can happen during initialization
                animationRef.current = requestAnimationFrame(updateCamera);
                return;
            }

            if (camera instanceof THREE.PerspectiveCamera) {
                // Create the off-axis projection matrix
                camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
                camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

                // Position camera at eye position
                camera.position.set(eyeX, eyeY, safeEyeZ);

                // Look at the focus point (where the "window" plane intersects scene)
                camera.lookAt(cameraX, cameraY, focusDepth);
                camera.updateMatrixWorld(true);
            }

            animationRef.current = requestAnimationFrame(updateCamera);
        };

        animationRef.current = requestAnimationFrame(updateCamera);

        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
                animationRef.current = null;
            }
            console.log('[SplatWindow] Stopped head tracking camera loop');
        };
    }, [controlMode, loading, headPosition, params]);

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
            {loading && !loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="glass-elevated rounded-2xl p-8 flex flex-col items-center">
                        <div className="relative w-20 h-20 mb-4">
                            <div className="absolute inset-0 rounded-full border-2 border-white/10" />
                            <div
                                className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                                style={{
                                    borderTopColor: '#3b82f6',
                                    borderRightColor: '#8b5cf6',
                                    animationDuration: '1s'
                                }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-lg font-semibold text-gradient-blue">
                                    {Math.round(loadProgress)}%
                                </span>
                            </div>
                        </div>
                        <div className="text-white/60 text-sm">Loading 3D Scene...</div>
                    </div>
                </div>
            )}

            {/* Error overlay */}
            {loadError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                    <div className="glass-error rounded-2xl p-8 max-w-md flex flex-col items-center">
                        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                            <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <div className="text-xl font-medium text-white mb-2">Failed to Load</div>
                        <div className="text-sm text-center text-red-300/80">{loadError}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
