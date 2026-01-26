import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

export interface HeadPosition {
    x: number;  // -1 to 1, left to right (from viewer's perspective)
    y: number;  // -1 to 1, down to up
    z: number;  // Relative depth (positive = closer to camera)
}

export interface SmoothedHeadPosition extends HeadPosition {
    // Smoothed values for camera updates
    smoothedX: number;
    smoothedY: number;
    smoothedZ: number;
}

const DEFAULT_SMOOTHING = 0.15;
const DEFAULT_DEAD_ZONE = 0.005;

/**
 * Depth Estimation via Face Width
 *
 * MediaPipe's Z coordinate is unreliable for depth (it's relative to head center).
 * Instead, we use FACE WIDTH as a proxy for distance to camera:
 * - Face appears LARGER when closer to camera
 * - Face appears SMALLER when farther from camera
 *
 * We measure the distance between landmarks on opposite sides of the face
 * and normalize it to a -1 to 1 range centered on a "neutral" face width.
 *
 * MediaPipe landmark indices for face width:
 * - 234 (left cheek) and 454 (right cheek) - full face width
 * - 33 (left eye outer) and 263 (right eye outer) - eye span
 * - 127 (left jaw) and 356 (right jaw) - jaw width
 *
 * Reference: https://research.google/blog/mediapipe-iris-real-time-iris-tracking-depth-estimation/
 */
const FACE_WIDTH_LEFT_LANDMARK = 234;   // Left side of face
const FACE_WIDTH_RIGHT_LANDMARK = 454;  // Right side of face
const FACE_WIDTH_SENSITIVITY = 3.0;     // How much face width change maps to Z change

export function useHeadTracking(smoothing = DEFAULT_SMOOTHING, deadZone = DEFAULT_DEAD_ZONE, enabled = true) {
    const [position, setPosition] = useState<HeadPosition>({ x: 0, y: 0, z: 0 });
    const [initializing, setInitializing] = useState(enabled);
    const [calibrationProgress, setCalibrationProgress] = useState(0);
    const [isCalibrated, setIsCalibrated] = useState(false);

    // Raw position ref (updated every frame)
    const rawPositionRef = useRef<HeadPosition>({ x: 0, y: 0, z: 0 });
    // Smoothed position ref (for high-frequency camera updates)
    const smoothedPositionRef = useRef<SmoothedHeadPosition>({
        x: 0, y: 0, z: 0,
        smoothedX: 0, smoothedY: 0, smoothedZ: 0
    });
    // Last stable position (for dead zone)
    const lastStablePositionRef = useRef<HeadPosition>({ x: 0, y: 0, z: 0 });

    // Baseline face width (calibrated on first detection)
    const baselineFaceWidthRef = useRef<number | null>(null);
    const calibrationFramesRef = useRef<number[]>([]);

    // Recalibrate function - resets calibration and starts fresh
    const recalibrate = useCallback(() => {
        baselineFaceWidthRef.current = null;
        calibrationFramesRef.current = [];
        setCalibrationProgress(0);
        setIsCalibrated(false);
        if (import.meta.env.DEV) console.log('[HeadTracking] Recalibration started');
    }, []);

    const videoRef = useRef<HTMLVideoElement>(null);
    const landmarkerRef = useRef<FaceLandmarker | null>(null);
    const requestRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(performance.now());

    // Expose smoothing params via ref so they can be updated without restarting tracking
    const smoothingRef = useRef(smoothing);
    const deadZoneRef = useRef(deadZone);

    // Update refs when props change
    useEffect(() => {
        smoothingRef.current = smoothing;
        deadZoneRef.current = deadZone;
    }, [smoothing, deadZone]);

    // Linear interpolation helper
    const lerp = useCallback((a: number, b: number, t: number) => a + (b - a) * t, []);

    // Calculate vector length
    const length = useCallback((dx: number, dy: number, dz: number) =>
        Math.sqrt(dx * dx + dy * dy + dz * dz), []);

    // Calculate 2D distance between two landmarks
    const landmarkDistance = useCallback((
        landmarks: Array<{x: number, y: number, z: number}>,
        idx1: number,
        idx2: number
    ) => {
        const p1 = landmarks[idx1];
        const p2 = landmarks[idx2];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }, []);

    useEffect(() => {
        // Don't initialize if not enabled - this enables lazy loading of MediaPipe
        if (!enabled) {
            setInitializing(false);
            return;
        }

        let active = true;
        const video = videoRef.current;

        const predictWebcam = () => {
            if (landmarkerRef.current && videoRef.current) {
                if (videoRef.current.videoWidth > 0 && videoRef.current.videoHeight > 0) {
                    const results = landmarkerRef.current.detectForVideo(videoRef.current, Date.now());
                    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                        const landmarks = results.faceLandmarks[0];
                        const nose = landmarks[1]; // Index 1 is nose tip

                        // Map MediaPipe coordinates (0..1) to Normalized Device Coordinates (-1..1)
                        // MediaPipe: x: 0 (left of image) -> 1 (right of image)
                        //            y: 0 (top) -> 1 (bottom)

                        // Our output:
                        // x: -1 (user left) to 1 (user right) - note: webcam is mirrored
                        // y: -1 (down) to 1 (up)
                        // z: positive = closer to screen (based on face width, not MediaPipe Z)

                        const rawX = (nose.x - 0.5) * 2;  // Center at 0, range -1 to 1
                        const rawY = (nose.y - 0.5) * -2; // Invert to make +Y up

                        // === DEPTH ESTIMATION VIA FACE WIDTH ===
                        // Calculate current face width (distance between left and right face landmarks)
                        const currentFaceWidth = landmarkDistance(
                            landmarks,
                            FACE_WIDTH_LEFT_LANDMARK,
                            FACE_WIDTH_RIGHT_LANDMARK
                        );

                        // Calibrate baseline on first few frames
                        if (baselineFaceWidthRef.current === null) {
                            calibrationFramesRef.current.push(currentFaceWidth);
                            setCalibrationProgress(calibrationFramesRef.current.length);
                            if (calibrationFramesRef.current.length >= 30) {
                                // Use median of first 30 frames as baseline
                                const sorted = [...calibrationFramesRef.current].sort((a, b) => a - b);
                                baselineFaceWidthRef.current = sorted[Math.floor(sorted.length / 2)];
                                setIsCalibrated(true);
                                if (import.meta.env.DEV) console.log('[HeadTracking] Baseline face width calibrated:', baselineFaceWidthRef.current.toFixed(4));
                            }
                        }

                        // Calculate Z from face width deviation
                        // Larger face = closer = positive Z
                        // Smaller face = farther = negative Z
                        let rawZ = 0;
                        if (baselineFaceWidthRef.current !== null) {
                            const widthDelta = currentFaceWidth - baselineFaceWidthRef.current;
                            // Normalize: ~0.1 change in face width maps to ~1.0 in Z
                            rawZ = widthDelta * FACE_WIDTH_SENSITIVITY;
                            // Clamp to reasonable range
                            rawZ = Math.max(-1, Math.min(1, rawZ));
                        }

                        // Store raw position
                        rawPositionRef.current = { x: rawX, y: rawY, z: rawZ };

                        // Calculate time delta for frame-rate independent smoothing
                        const currentTime = performance.now();
                        const deltaTime = (currentTime - lastTimeRef.current) / 1000; // Convert to seconds
                        lastTimeRef.current = currentTime;

                        // Get current smoothing params
                        const currentSmoothing = smoothingRef.current;
                        const currentDeadZone = deadZoneRef.current;

                        // Apply dead zone to reduce micro-jitter
                        const dx = rawX - lastStablePositionRef.current.x;
                        const dy = rawY - lastStablePositionRef.current.y;
                        const dz = rawZ - lastStablePositionRef.current.z;
                        const delta = length(dx, dy, dz);

                        let targetX = lastStablePositionRef.current.x;
                        let targetY = lastStablePositionRef.current.y;
                        let targetZ = lastStablePositionRef.current.z;

                        if (delta > currentDeadZone) {
                            // Movement exceeds dead zone, update target
                            targetX = rawX;
                            targetY = rawY;
                            targetZ = rawZ;
                            lastStablePositionRef.current = { x: targetX, y: targetY, z: targetZ };
                        }

                        // Apply exponential smoothing (frame-rate independent)
                        // smoothingFactor is tuned for ~60fps, scale by deltaTime
                        const smoothFactor = Math.min(1, currentSmoothing * deltaTime * 60);

                        const prevSmoothed = smoothedPositionRef.current;
                        const smoothedX = lerp(prevSmoothed.smoothedX, targetX, smoothFactor);
                        const smoothedY = lerp(prevSmoothed.smoothedY, targetY, smoothFactor);
                        const smoothedZ = lerp(prevSmoothed.smoothedZ, targetZ, smoothFactor);

                        // Update smoothed position ref
                        smoothedPositionRef.current = {
                            x: rawX,
                            y: rawY,
                            z: rawZ,
                            smoothedX,
                            smoothedY,
                            smoothedZ
                        };

                        // Update state (less frequently, for UI display)
                        setPosition({ x: smoothedX, y: smoothedY, z: smoothedZ });
                    }
                }
            }
            requestRef.current = requestAnimationFrame(predictWebcam);
        };

        const startWebcam = () => {
            navigator.mediaDevices.getUserMedia({ video: true })
                .then((stream) => {
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        videoRef.current.play()
                            .then(() => {
                                if (import.meta.env.DEV) console.log('[HeadTracking] Video playback started');
                            })
                            .catch((e) => {
                                console.error('[HeadTracking] Video play failed:', e);
                            });
                        videoRef.current.addEventListener("loadeddata", predictWebcam, { once: true });
                    }
                })
                .catch((err) => {
                    console.error('[HeadTracking] Camera access error:', err.name, err.message);
                    if (err.name === 'NotAllowedError') {
                        console.warn('[HeadTracking] Permission denied by user');
                    } else if (err.name === 'NotFoundError') {
                        console.warn('[HeadTracking] No camera found on device');
                    } else if (err.name === 'NotReadableError') {
                        console.warn('[HeadTracking] Camera may be in use by another application');
                    }
                    setInitializing(false);
                });
        };

        async function startFaceLandmarker() {
            try {
                const filesetResolver = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
                );
                if (!active) return;

                landmarkerRef.current = await FaceLandmarker.createFromOptions(filesetResolver, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                        delegate: "GPU"
                    },
                    outputFaceBlendshapes: false,
                    runningMode: "VIDEO",
                    numFaces: 1
                });

                if (active) {
                    setInitializing(false);
                    startWebcam();
                }
            } catch (error) {
                if (active) {
                    console.error("[HeadTracking] Error initializing FaceLandmarker:", error);
                    setInitializing(false);
                }
            }
        }

        startFaceLandmarker();

        return () => {
            active = false;
            cancelAnimationFrame(requestRef.current);
            if (video && video.srcObject) {
                const stream = video.srcObject as MediaStream;
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [lerp, length, landmarkDistance, enabled]);

    return {
        position,                    // Smoothed position for React state/UI
        positionRef: smoothedPositionRef,  // Smoothed position ref for camera updates
        rawPositionRef,              // Raw position ref (unsmoothed)
        initializing,
        videoRef,
        // Calibration state
        calibrationProgress,         // 0-30 frames collected
        isCalibrated,                // Whether baseline is established
        recalibrate,                 // Function to trigger recalibration
    };
}
