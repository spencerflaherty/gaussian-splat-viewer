import { LiquidGlass } from '../ui/LiquidGlass';

export interface CalibrationWizardProps {
  /** Whether the wizard is visible */
  visible: boolean;
  /** Current calibration progress (0-30) */
  progress: number;
  /** Whether calibration is complete */
  isCalibrated: boolean;
  /** Function to trigger recalibration */
  onRecalibrate: () => void;
}

const TOTAL_FRAMES = 30;

/**
 * Calibration Wizard - Shows progress during head tracking calibration
 *
 * Displays:
 * - Progress bar during initial calibration
 * - "Hold still" instruction while calibrating
 * - "Recalibrate" button after calibration complete
 */
export function CalibrationWizard({
  visible,
  progress,
  isCalibrated,
  onRecalibrate,
}: CalibrationWizardProps) {
  if (!visible) return null;

  const percentage = Math.min(100, (progress / TOTAL_FRAMES) * 100);

  return (
    <div style={{
      position: 'absolute',
      top: 290, // Below camera position box
      right: 16,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <LiquidGlass variant="sidebar" style={{ width: 220, padding: 16 }}>
        {!isCalibrated ? (
          // Calibrating state
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: 'linear-gradient(180deg, #FF9500 0%, #FF3B30 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)' }}>
                Calibrating...
              </span>
            </div>

            {/* Progress bar */}
            <div style={{
              width: '100%',
              height: 6,
              borderRadius: 3,
              background: 'rgba(0, 0, 0, 0.1)',
              overflow: 'hidden',
              marginBottom: 10,
            }}>
              <div style={{
                width: `${percentage}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #FF9500, #FF3B30)',
                borderRadius: 3,
                transition: 'width 0.1s ease-out',
              }} />
            </div>

            {/* Hold still instruction */}
            <div style={{
              fontSize: 12,
              color: 'rgba(0, 0, 0, 0.5)',
              textAlign: 'center',
            }}>
              Hold still for a moment...
            </div>
          </div>
        ) : (
          // Calibrated state
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 12,
            }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: 'linear-gradient(180deg, #34C759 0%, #30D158 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)' }}>
                Calibrated
              </span>
            </div>

            {/* Recalibrate button */}
            <button
              onClick={onRecalibrate}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                border: 'none',
                background: 'rgba(0, 122, 255, 0.1)',
                color: '#007AFF',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                transition: 'all 0.2s ease',
              }}
            >
              Recalibrate
            </button>
          </div>
        )}
      </LiquidGlass>
    </div>
  );
}
