/**
 * Touch Drag Input Source
 *
 * Uses touch/mouse drag to control parallax view.
 * Works on all devices as a fallback input method.
 * Returns to center when released.
 */

import type { ParallaxInput, ParallaxPosition } from './inputSources';
import { clamp, lerp } from './inputSources';

interface TouchInputOptions {
  /** Element to attach listeners to (default: document.body) */
  element?: HTMLElement;
  /** Sensitivity multiplier (default: 1.0) */
  sensitivity?: number;
  /** Smoothing factor 0-1 (default: 0.15) */
  smoothing?: number;
  /** Return to center speed when released (default: 0.1) */
  returnSpeed?: number;
  /** Drag distance for full deflection in pixels (default: 150) */
  dragRange?: number;
}

export class TouchInput implements ParallaxInput {
  readonly id = 'touch';
  readonly name = 'Touch Drag';

  private _isAvailable = true; // Always available
  private _isActive = false;
  private _position: ParallaxPosition = { x: 0, y: 0, z: 0 };
  private _smoothedPosition: ParallaxPosition = { x: 0, y: 0, z: 0 };

  private element: HTMLElement;
  private sensitivity: number;
  private smoothing: number;
  private returnSpeed: number;
  private dragRange: number;

  // Touch state
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;

  // Animation frame for smoothing
  private animationFrameId: number | null = null;

  // Event handlers for cleanup
  private boundHandlers: {
    touchStart: (e: TouchEvent) => void;
    touchMove: (e: TouchEvent) => void;
    touchEnd: () => void;
    mouseDown: (e: MouseEvent) => void;
    mouseMove: (e: MouseEvent) => void;
    mouseUp: () => void;
  } | null = null;

  constructor(options: TouchInputOptions = {}) {
    this.element = options.element ?? document.body;
    this.sensitivity = options.sensitivity ?? 1.0;
    this.smoothing = options.smoothing ?? 0.15;
    this.returnSpeed = options.returnSpeed ?? 0.1;
    this.dragRange = options.dragRange ?? 150;
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
    // Set up event handlers
    this.boundHandlers = {
      touchStart: (e: TouchEvent) => this.onTouchStart(e),
      touchMove: (e: TouchEvent) => this.onTouchMove(e),
      touchEnd: () => this.onTouchEnd(),
      mouseDown: (e: MouseEvent) => this.onMouseDown(e),
      mouseMove: (e: MouseEvent) => this.onMouseMove(e),
      mouseUp: () => this.onMouseUp(),
    };

    // Touch events
    this.element.addEventListener('touchstart', this.boundHandlers.touchStart, { passive: true });
    this.element.addEventListener('touchmove', this.boundHandlers.touchMove, { passive: true });
    this.element.addEventListener('touchend', this.boundHandlers.touchEnd);
    this.element.addEventListener('touchcancel', this.boundHandlers.touchEnd);

    // Mouse events (for desktop fallback)
    this.element.addEventListener('mousedown', this.boundHandlers.mouseDown);
    window.addEventListener('mousemove', this.boundHandlers.mouseMove);
    window.addEventListener('mouseup', this.boundHandlers.mouseUp);

    // Start animation loop
    this.animate();
    this._isActive = true;

    if (import.meta.env.DEV) {
      console.log('[TouchInput] Started');
    }
  }

  stop(): void {
    // Remove event listeners
    if (this.boundHandlers) {
      this.element.removeEventListener('touchstart', this.boundHandlers.touchStart);
      this.element.removeEventListener('touchmove', this.boundHandlers.touchMove);
      this.element.removeEventListener('touchend', this.boundHandlers.touchEnd);
      this.element.removeEventListener('touchcancel', this.boundHandlers.touchEnd);
      this.element.removeEventListener('mousedown', this.boundHandlers.mouseDown);
      window.removeEventListener('mousemove', this.boundHandlers.mouseMove);
      window.removeEventListener('mouseup', this.boundHandlers.mouseUp);
      this.boundHandlers = null;
    }

    // Cancel animation
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    this._isActive = false;

    if (import.meta.env.DEV) {
      console.log('[TouchInput] Stopped');
    }
  }

  calibrate(): void {
    // Reset to center
    this._position = { x: 0, y: 0, z: 0 };
    this._smoothedPosition = { x: 0, y: 0, z: 0 };
    this.isDragging = false;

    if (import.meta.env.DEV) {
      console.log('[TouchInput] Calibrated');
    }
  }

  dispose(): void {
    this.stop();
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      this.startDrag(touch.clientX, touch.clientY);
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (this.isDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      this.updateDrag(touch.clientX, touch.clientY);
    }
  }

  private onTouchEnd(): void {
    this.endDrag();
  }

  private onMouseDown(e: MouseEvent): void {
    // Only respond to left click
    if (e.button === 0) {
      this.startDrag(e.clientX, e.clientY);
    }
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isDragging) {
      this.updateDrag(e.clientX, e.clientY);
    }
  }

  private onMouseUp(): void {
    this.endDrag();
  }

  private startDrag(x: number, y: number): void {
    this.isDragging = true;
    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;
  }

  private updateDrag(x: number, y: number): void {
    this.currentX = x;
    this.currentY = y;

    // Calculate delta from start
    const deltaX = (this.currentX - this.startX) / this.dragRange;
    const deltaY = (this.currentY - this.startY) / this.dragRange;

    // Update position (invert Y for natural feel)
    this._position = {
      x: clamp(deltaX * this.sensitivity, -1, 1),
      y: clamp(-deltaY * this.sensitivity, -1, 1),
      z: 0,
    };
  }

  private endDrag(): void {
    this.isDragging = false;
  }

  private animate = (): void => {
    if (!this._isActive) return;

    if (this.isDragging) {
      // Smooth toward current position
      this._smoothedPosition = {
        x: lerp(this._smoothedPosition.x, this._position.x, this.smoothing),
        y: lerp(this._smoothedPosition.y, this._position.y, this.smoothing),
        z: 0,
      };
    } else {
      // Return to center when not dragging
      this._position = {
        x: lerp(this._position.x, 0, this.returnSpeed),
        y: lerp(this._position.y, 0, this.returnSpeed),
        z: 0,
      };
      this._smoothedPosition = {
        x: lerp(this._smoothedPosition.x, 0, this.returnSpeed),
        y: lerp(this._smoothedPosition.y, 0, this.returnSpeed),
        z: 0,
      };
    }

    this.animationFrameId = requestAnimationFrame(this.animate);
  };
}
