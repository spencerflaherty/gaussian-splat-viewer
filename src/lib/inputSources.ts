/**
 * Input Source Abstraction Layer
 *
 * Provides a unified interface for different parallax input methods:
 * - Head tracking (webcam + MediaPipe)
 * - Gyroscope (mobile device orientation)
 * - Touch drag (fallback for all devices)
 *
 * All input sources output normalized position data:
 * - x: -1 (left) to 1 (right)
 * - y: -1 (down) to 1 (up)
 * - z: -1 (far) to 1 (near) - depth/zoom
 */

export interface ParallaxPosition {
  x: number;
  y: number;
  z: number;
}

export interface ParallaxInput {
  /** Unique identifier for this input source */
  readonly id: string;

  /** Human-readable name for UI */
  readonly name: string;

  /** Whether this input source is available on the current device */
  readonly isAvailable: boolean;

  /** Whether the input source is currently active and tracking */
  readonly isActive: boolean;

  /** Current position (normalized -1 to 1) */
  readonly position: ParallaxPosition;

  /** Initialize and start tracking */
  start(): Promise<void>;

  /** Stop tracking and release resources */
  stop(): void;

  /** Reset to neutral position / recalibrate */
  calibrate(): void;

  /** Clean up all resources */
  dispose(): void;
}

/**
 * Input source capabilities for feature detection
 */
export interface InputCapabilities {
  hasWebcam: boolean;
  hasGyroscope: boolean;
  hasTouch: boolean;
  isMobile: boolean;
}

/**
 * Detect available input capabilities on the current device
 */
export async function detectCapabilities(): Promise<InputCapabilities> {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  // Check webcam availability
  let hasWebcam = false;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    hasWebcam = devices.some((device) => device.kind === 'videoinput');
  } catch {
    hasWebcam = false;
  }

  // Check gyroscope availability
  let hasGyroscope = false;
  if ('DeviceOrientationEvent' in window) {
    // On iOS 13+, we need to request permission
    if (
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === 'function'
    ) {
      // Permission needs to be requested on user gesture
      hasGyroscope = true; // Assume available, will fail gracefully
    } else {
      hasGyroscope = true;
    }
  }

  // Check touch availability
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  return {
    hasWebcam,
    hasGyroscope,
    hasTouch,
    isMobile,
  };
}

/**
 * Get the recommended input source for the current device
 */
export function getRecommendedInputSource(capabilities: InputCapabilities): string {
  if (capabilities.isMobile) {
    // Mobile: prefer gyroscope, fallback to touch
    return capabilities.hasGyroscope ? 'gyroscope' : 'touch';
  } else {
    // Desktop: prefer head tracking, fallback to touch/mouse
    return capabilities.hasWebcam ? 'head' : 'touch';
  }
}

/**
 * Linear interpolation helper
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Clamp value to range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Apply dead zone to value
 */
export function applyDeadZone(value: number, deadZone: number): number {
  if (Math.abs(value) < deadZone) {
    return 0;
  }
  // Scale value to remove dead zone discontinuity
  const sign = value > 0 ? 1 : -1;
  return sign * ((Math.abs(value) - deadZone) / (1 - deadZone));
}
