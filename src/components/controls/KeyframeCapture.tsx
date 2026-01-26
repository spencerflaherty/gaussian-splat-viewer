import { useCallback } from 'react';
import * as THREE from 'three';
import { LiquidGlass } from '../ui/LiquidGlass';
import { useAnimationStore, type CameraKeyframe } from '../../stores';

interface KeyframeCaptureProps {
  /** Current camera from the viewer */
  camera: THREE.PerspectiveCamera | null;
  /** Whether we're in orbit mode (required for keyframe capture) */
  isOrbitMode: boolean;
}

/**
 * KeyframeCapture - UI for setting animation start/end points
 *
 * Appears in orbit mode to let users capture camera positions
 * for creating animated camera paths.
 */
export function KeyframeCapture({ camera, isOrbitMode }: KeyframeCaptureProps) {
  const {
    startKeyframe,
    endKeyframe,
    setStartKeyframe,
    setEndKeyframe,
    clearKeyframes,
  } = useAnimationStore();

  const captureKeyframe = useCallback((): CameraKeyframe | null => {
    if (!camera) return null;

    return {
      position: camera.position.clone(),
      quaternion: camera.quaternion.clone(),
      timestamp: Date.now(),
    };
  }, [camera]);

  const handleSetStart = useCallback(() => {
    const keyframe = captureKeyframe();
    if (keyframe) {
      setStartKeyframe(keyframe);
      if (import.meta.env.DEV) {
        console.log('[KeyframeCapture] Start keyframe set:', keyframe.position.toArray());
      }
    }
  }, [captureKeyframe, setStartKeyframe]);

  const handleSetEnd = useCallback(() => {
    const keyframe = captureKeyframe();
    if (keyframe) {
      setEndKeyframe(keyframe);
      if (import.meta.env.DEV) {
        console.log('[KeyframeCapture] End keyframe set:', keyframe.position.toArray());
      }
    }
  }, [captureKeyframe, setEndKeyframe]);

  if (!isOrbitMode) return null;

  return (
    <LiquidGlass
      variant="sidebar"
      style={{
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minWidth: 180,
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0, 0, 0, 0.7)' }}>
          Animation
        </span>
        {(startKeyframe || endKeyframe) && (
          <button
            onClick={clearKeyframes}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 12,
              color: '#FF3B30',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Keyframe Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSetStart}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: startKeyframe ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0, 0, 0, 0.05)',
            border: startKeyframe ? '1px solid rgba(52, 199, 89, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            color: startKeyframe ? '#34C759' : 'rgba(0, 0, 0, 0.7)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {startKeyframe ? '✓' : '◯'} Start
        </button>

        <button
          onClick={handleSetEnd}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: endKeyframe ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0, 0, 0, 0.05)',
            border: endKeyframe ? '1px solid rgba(52, 199, 89, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            color: endKeyframe ? '#34C759' : 'rgba(0, 0, 0, 0.7)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {endKeyframe ? '✓' : '◯'} End
        </button>
      </div>

      {/* Ready indicator */}
      {startKeyframe && endKeyframe && (
        <div style={{
          padding: '6px 10px',
          background: 'rgba(0, 122, 255, 0.1)',
          borderRadius: 6,
          fontSize: 12,
          color: '#007AFF',
          textAlign: 'center',
        }}>
          Ready to export
        </div>
      )}

      {/* Instructions */}
      {!startKeyframe && !endKeyframe && (
        <p style={{
          fontSize: 11,
          color: 'rgba(0, 0, 0, 0.4)',
          margin: 0,
          textAlign: 'center',
        }}>
          Position camera, then set start & end
        </p>
      )}
    </LiquidGlass>
  );
}
