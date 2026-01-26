import { create } from 'zustand';
import * as THREE from 'three';

/**
 * Camera keyframe with position and rotation
 */
export interface CameraKeyframe {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  timestamp?: number;
}

/**
 * Easing function type
 */
export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'custom';

/**
 * Custom cubic bezier control points [p1x, p1y, p2x, p2y]
 */
export type BezierControlPoints = [number, number, number, number];

/**
 * Animation export resolution preset
 */
export interface ResolutionPreset {
  name: string;
  width: number;
  height: number;
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { name: '720p', width: 1280, height: 720 },
  { name: '1080p', width: 1920, height: 1080 },
  { name: '4K', width: 3840, height: 2160 },
  { name: 'Square', width: 1080, height: 1080 },
  { name: 'Portrait', width: 1080, height: 1920 },
];

interface AnimationState {
  // Keyframes
  startKeyframe: CameraKeyframe | null;
  endKeyframe: CameraKeyframe | null;

  // Animation settings
  duration: number; // seconds
  fps: number;
  easing: EasingType;
  customBezier: BezierControlPoints;

  // Export settings
  resolution: ResolutionPreset;
  quality: number; // 1-100

  // Preview state
  isPreviewPlaying: boolean;
  previewProgress: number; // 0-1

  // Export state
  isExporting: boolean;
  exportProgress: number; // 0-1

  // Actions
  setStartKeyframe: (keyframe: CameraKeyframe | null) => void;
  setEndKeyframe: (keyframe: CameraKeyframe | null) => void;
  setDuration: (duration: number) => void;
  setFps: (fps: number) => void;
  setEasing: (easing: EasingType) => void;
  setCustomBezier: (bezier: BezierControlPoints) => void;
  setResolution: (resolution: ResolutionPreset) => void;
  setQuality: (quality: number) => void;
  setPreviewPlaying: (playing: boolean) => void;
  setPreviewProgress: (progress: number) => void;
  setExporting: (exporting: boolean) => void;
  setExportProgress: (progress: number) => void;
  clearKeyframes: () => void;
  reset: () => void;
}

const DEFAULT_RESOLUTION = RESOLUTION_PRESETS[1]; // 1080p

/**
 * Animation Store
 *
 * Manages animation state for camera path export:
 * - Start/end keyframes with position and rotation
 * - Animation duration and FPS
 * - Easing functions including custom cubic bezier
 * - Export resolution and quality
 * - Preview and export progress tracking
 */
export const useAnimationStore = create<AnimationState>()((set) => ({
  // Keyframes
  startKeyframe: null,
  endKeyframe: null,

  // Animation settings
  duration: 3,
  fps: 30,
  easing: 'easeInOut',
  customBezier: [0.42, 0, 0.58, 1], // Default ease-in-out

  // Export settings
  resolution: DEFAULT_RESOLUTION,
  quality: 80,

  // Preview state
  isPreviewPlaying: false,
  previewProgress: 0,

  // Export state
  isExporting: false,
  exportProgress: 0,

  // Actions
  setStartKeyframe: (keyframe) => set({ startKeyframe: keyframe }),
  setEndKeyframe: (keyframe) => set({ endKeyframe: keyframe }),
  setDuration: (duration) => set({ duration: Math.max(0.5, Math.min(30, duration)) }),
  setFps: (fps) => set({ fps: Math.max(15, Math.min(60, fps)) }),
  setEasing: (easing) => set({ easing }),
  setCustomBezier: (bezier) => set({ customBezier: bezier }),
  setResolution: (resolution) => set({ resolution }),
  setQuality: (quality) => set({ quality: Math.max(1, Math.min(100, quality)) }),
  setPreviewPlaying: (playing) => set({ isPreviewPlaying: playing }),
  setPreviewProgress: (progress) => set({ previewProgress: Math.max(0, Math.min(1, progress)) }),
  setExporting: (exporting) => set({ isExporting: exporting }),
  setExportProgress: (progress) => set({ exportProgress: Math.max(0, Math.min(1, progress)) }),

  clearKeyframes: () =>
    set({
      startKeyframe: null,
      endKeyframe: null,
      previewProgress: 0,
    }),

  reset: () =>
    set({
      startKeyframe: null,
      endKeyframe: null,
      duration: 3,
      fps: 30,
      easing: 'easeInOut',
      customBezier: [0.42, 0, 0.58, 1],
      resolution: DEFAULT_RESOLUTION,
      quality: 80,
      isPreviewPlaying: false,
      previewProgress: 0,
      isExporting: false,
      exportProgress: 0,
    }),
}));

/**
 * Interpolate between two camera keyframes
 *
 * @param start Start keyframe
 * @param end End keyframe
 * @param t Progress 0-1 (should be eased)
 * @returns Interpolated position and quaternion
 */
export function interpolateKeyframes(
  start: CameraKeyframe,
  end: CameraKeyframe,
  t: number
): { position: THREE.Vector3; quaternion: THREE.Quaternion } {
  // Clamp t to [0, 1]
  t = Math.max(0, Math.min(1, t));

  // Interpolate position (linear)
  const position = new THREE.Vector3().lerpVectors(start.position, end.position, t);

  // Interpolate rotation (spherical linear interpolation)
  const quaternion = new THREE.Quaternion().slerpQuaternions(start.quaternion, end.quaternion, t);

  return { position, quaternion };
}

/**
 * Apply easing function to progress value
 *
 * @param t Progress 0-1
 * @param easing Easing type
 * @param bezier Custom bezier points for 'custom' easing
 * @returns Eased progress 0-1
 */
export function applyEasing(
  t: number,
  easing: EasingType,
  bezier?: BezierControlPoints
): number {
  switch (easing) {
    case 'linear':
      return t;

    case 'easeIn':
      return t * t * t;

    case 'easeOut':
      return 1 - Math.pow(1 - t, 3);

    case 'easeInOut':
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    case 'custom':
      if (bezier) {
        return cubicBezier(bezier[0], bezier[1], bezier[2], bezier[3], t);
      }
      return t;

    default:
      return t;
  }
}

/**
 * Cubic bezier easing function
 * Attempt to approximate the CSS cubic-bezier timing function
 */
function cubicBezier(p1x: number, p1y: number, p2x: number, p2y: number, t: number): number {
  // Newton-Raphson iteration to find t for x
  const NEWTON_ITERATIONS = 4;
  const NEWTON_MIN_SLOPE = 0.001;

  const ax = 3 * p1x - 3 * p2x + 1;
  const bx = 3 * p2x - 6 * p1x;
  const cx = 3 * p1x;

  const ay = 3 * p1y - 3 * p2y + 1;
  const by = 3 * p2y - 6 * p1y;
  const cy = 3 * p1y;

  // Get x for t
  function sampleCurveX(t: number): number {
    return ((ax * t + bx) * t + cx) * t;
  }

  // Get y for t
  function sampleCurveY(t: number): number {
    return ((ay * t + by) * t + cy) * t;
  }

  // Get derivative of x
  function sampleCurveDerivativeX(t: number): number {
    return (3 * ax * t + 2 * bx) * t + cx;
  }

  // Find t for given x using Newton-Raphson
  function solveCurveX(x: number): number {
    let t2 = t;
    for (let i = 0; i < NEWTON_ITERATIONS; i++) {
      const slope = sampleCurveDerivativeX(t2);
      if (Math.abs(slope) < NEWTON_MIN_SLOPE) {
        break;
      }
      const currentX = sampleCurveX(t2) - x;
      t2 -= currentX / slope;
    }
    return t2;
  }

  // Solve for t given x, then get y
  const tForX = solveCurveX(t);
  return sampleCurveY(tForX);
}
