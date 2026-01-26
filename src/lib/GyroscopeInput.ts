/**
 * Gyroscope Input Source
 *
 * Uses device orientation (gyroscope) to control parallax view on mobile devices.
 * Maps device tilt to x/y position for natural "look around" effect.
 */

import type { ParallaxInput, ParallaxPosition } from './inputSources';
import { clamp, lerp, applyDeadZone } from './inputSources';

interface GyroscopeOptions {
  /** Sensitivity multiplier (default: 1.0) */
  sensitivity?: number;
  /** Smoothing factor 0-1 (default: 0.15) */
  smoothing?: number;
  /** Dead zone threshold (default: 0.02) */
  deadZone?: number;
  /** Maximum tilt angle in degrees (default: 30) */
  maxTilt?: number;
}

export class GyroscopeInput implements ParallaxInput {
  readonly id = 'gyroscope';
  readonly name = 'Gyroscope';

  private _isAvailable = false;
  private _isActive = false;
  private _smoothedPosition: ParallaxPosition = { x: 0, y: 0, z: 0 };

  private sensitivity: number;
  private smoothing: number;
  private deadZone: number;
  private maxTilt: number;

  // Calibration baseline
  private baselineAlpha: number | null = null;
  private baselineBeta: number | null = null;
  private baselineGamma: number | null = null;

  // Event handler reference for cleanup
  private handleOrientation: ((event: DeviceOrientationEvent) => void) | null = null;

  constructor(options: GyroscopeOptions = {}) {
    this.sensitivity = options.sensitivity ?? 1.0;
    this.smoothing = options.smoothing ?? 0.15;
    this.deadZone = options.deadZone ?? 0.02;
    this.maxTilt = options.maxTilt ?? 30;

    // Check availability
    this._isAvailable = 'DeviceOrientationEvent' in window;
  }

  get isAvailable(): boolean {
    return this._isAvailable;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get position(): ParallaxPosition {
    return { ...this._smoothedPosition };
  }

  async start(): Promise<void> {
    if (!this._isAvailable) {
      throw new Error('Gyroscope not available on this device');
    }

    // Request permission on iOS 13+
    if (
      typeof (DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> })
        .requestPermission === 'function'
    ) {
      try {
        const permission = await (
          DeviceOrientationEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        if (permission !== 'granted') {
          throw new Error('Gyroscope permission denied');
        }
      } catch (error) {
        throw new Error(`Failed to get gyroscope permission: ${error}`);
      }
    }

    // Set up event listener
    this.handleOrientation = (event: DeviceOrientationEvent) => {
      this.onDeviceOrientation(event);
    };

    window.addEventListener('deviceorientation', this.handleOrientation);
    this._isActive = true;

    if (import.meta.env.DEV) {
      console.log('[GyroscopeInput] Started');
    }
  }

  stop(): void {
    if (this.handleOrientation) {
      window.removeEventListener('deviceorientation', this.handleOrientation);
      this.handleOrientation = null;
    }
    this._isActive = false;

    if (import.meta.env.DEV) {
      console.log('[GyroscopeInput] Stopped');
    }
  }

  calibrate(): void {
    // Reset baseline - next orientation reading will set new baseline
    this.baselineAlpha = null;
    this.baselineBeta = null;
    this.baselineGamma = null;
    this._smoothedPosition = { x: 0, y: 0, z: 0 };

    if (import.meta.env.DEV) {
      console.log('[GyroscopeInput] Calibrated');
    }
  }

  dispose(): void {
    this.stop();
  }

  private onDeviceOrientation(event: DeviceOrientationEvent): void {
    const { alpha, beta, gamma } = event;

    // Skip if no data
    if (alpha === null || beta === null || gamma === null) {
      return;
    }

    // Set baseline on first reading
    if (this.baselineAlpha === null) {
      this.baselineAlpha = alpha;
      this.baselineBeta = beta;
      this.baselineGamma = gamma;
      return;
    }

    // Calculate delta from baseline
    // gamma: left/right tilt (-90 to 90)
    // beta: front/back tilt (-180 to 180)
    const deltaGamma = gamma - (this.baselineGamma ?? 0);
    const deltaBeta = beta - (this.baselineBeta ?? 0);

    // Normalize to -1 to 1 range based on maxTilt
    const rawX = clamp(deltaGamma / this.maxTilt, -1, 1) * this.sensitivity;
    const rawY = clamp(-deltaBeta / this.maxTilt, -1, 1) * this.sensitivity; // Invert for natural feel

    // Apply dead zone
    const x = applyDeadZone(rawX, this.deadZone);
    const y = applyDeadZone(rawY, this.deadZone);

    // Apply smoothing
    this._smoothedPosition = {
      x: lerp(this._smoothedPosition.x, x, this.smoothing),
      y: lerp(this._smoothedPosition.y, y, this.smoothing),
      z: 0, // No Z from gyroscope
    };
  }
}
