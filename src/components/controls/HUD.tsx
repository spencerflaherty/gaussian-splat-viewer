import { createPortal } from 'react-dom';
import { LiquidGlass } from '../ui/LiquidGlass';
import { ModeSwitcher } from './ModeSwitcher';
import { SettingsPanel } from './SettingsPanel';
import { CalibrationWizard } from './CalibrationWizard';
import type { CameraPositionData } from '../viewer/SplatViewer';

export interface HUDOverlayProps {
  showControls: boolean;
  controlMode: 'head' | 'orbit';
  setControlMode: (mode: 'head' | 'orbit') => void;
  fileName: string | null;
  splatUrl: string;
  handleExit: () => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  darkBackground: boolean;
  setDarkBackground: (dark: boolean) => void;
  // Calibration props
  calibrationProgress: number;
  isCalibrated: boolean;
  onRecalibrate: () => void;
  // First-use highlight
  highlightSettings?: boolean;
  // Center view callback
  onCenterView?: () => void;
  // Camera position for debugging
  cameraPosition?: CameraPositionData | null;
}

/**
 * HUD Overlay - Heads-up display for the splat viewer
 *
 * Contains:
 * - Mode switcher (Head Track / Orbit)
 * - Bottom bar (file info, download, close)
 * - Settings panel (when in head tracking mode)
 */
export function HUDOverlay({
  showControls,
  controlMode,
  setControlMode,
  fileName,
  splatUrl,
  handleExit,
  showSettings,
  setShowSettings,
  darkBackground,
  setDarkBackground,
  calibrationProgress,
  isCalibrated,
  onRecalibrate,
  highlightSettings = false,
  onCenterView,
  cameraPosition,
}: HUDOverlayProps) {
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, pointerEvents: 'none' }}>

      {/* Top Mode Switcher */}
      <ModeSwitcher
        controlMode={controlMode}
        setControlMode={setControlMode}
        visible={showControls}
      />

      {/* Camera Position Debug Box (top-right) */}
      {cameraPosition && (
        <div style={{
          position: 'absolute',
          top: 16,
          right: 16,
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: showControls ? 'auto' : 'none',
        }}>
          <LiquidGlass variant="sidebar" style={{ padding: 12, minWidth: 180 }}>
            <div style={{ fontSize: 11, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 8 }}>
              Camera Position
            </div>
            <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 12, lineHeight: 1.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(0, 0, 0, 0.5)' }}>X:</span>
                <span style={{ color: 'rgba(0, 0, 0, 0.85)', fontWeight: 500 }}>{cameraPosition.x.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(0, 0, 0, 0.5)' }}>Y:</span>
                <span style={{ color: 'rgba(0, 0, 0, 0.85)', fontWeight: 500 }}>{cameraPosition.y.toFixed(3)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'rgba(0, 0, 0, 0.5)' }}>Z:</span>
                <span style={{ color: 'rgba(0, 0, 0, 0.85)', fontWeight: 500 }}>{cameraPosition.z.toFixed(3)}</span>
              </div>
            </div>
            <div style={{ borderTop: '0.5px solid rgba(0, 0, 0, 0.1)', marginTop: 8, paddingTop: 8 }}>
              <div style={{ fontSize: 10, color: 'rgba(0, 0, 0, 0.35)', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 4 }}>
                Look At
              </div>
              <div style={{ fontFamily: 'SF Mono, monospace', fontSize: 11, color: 'rgba(0, 0, 0, 0.6)' }}>
                ({cameraPosition.targetX.toFixed(2)}, {cameraPosition.targetY.toFixed(2)}, {cameraPosition.targetZ.toFixed(2)})
              </div>
            </div>
          </LiquidGlass>
        </div>
      )}

      {/* Bottom Bar */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: showControls ? 'auto' : 'none',
      }}>
        <LiquidGlass variant="pill" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {fileName && (
            <>
              <div style={{ padding: '4px 12px' }}>
                <div style={{ fontSize: 10, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>Scene</div>
                <div style={{ fontSize: 13, color: 'rgba(0, 0, 0, 0.85)', fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fileName}</div>
              </div>
              <div style={{ width: 1, height: 28, background: 'rgba(0, 0, 0, 0.1)' }} />
            </>
          )}
          {/* Center View button */}
          {onCenterView && (
            <>
              <button
                onClick={onCenterView}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  background: 'rgba(0, 0, 0, 0.05)',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(0, 0, 0, 0.6)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                title="Center View"
              >
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="3" />
                  <path strokeLinecap="round" d="M12 2v4m0 12v4M2 12h4m12 0h4" />
                </svg>
              </button>
              <div style={{ width: 1, height: 28, background: 'rgba(0, 0, 0, 0.1)' }} />
            </>
          )}
          {/* Background toggle */}
          <button
            onClick={() => setDarkBackground(!darkBackground)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: 'rgba(0, 0, 0, 0.05)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(0, 0, 0, 0.6)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title={darkBackground ? 'Switch to light background' : 'Switch to dark background'}
          >
            {darkBackground ? (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
              </svg>
            )}
          </button>
          <div style={{ width: 1, height: 28, background: 'rgba(0, 0, 0, 0.1)' }} />
          <a
            href={splatUrl}
            download={fileName?.replace(/\.[^.]+$/, '.ply') || 'scene.ply'}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: 'rgba(0, 0, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(0, 0, 0, 0.6)',
              textDecoration: 'none',
              transition: 'all 0.2s ease',
            }}
            title="Download"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
          <button
            onClick={handleExit}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              background: 'rgba(0, 0, 0, 0.05)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(0, 0, 0, 0.6)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            title="Close"
          >
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </LiquidGlass>
      </div>

      {/* Settings Panel */}
      {controlMode === 'head' && (
        <SettingsPanel
          visible={showControls}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          highlight={highlightSettings}
        />
      )}

      {/* Calibration Wizard */}
      {controlMode === 'head' && (
        <CalibrationWizard
          visible={showControls}
          progress={calibrationProgress}
          isCalibrated={isCalibrated}
          onRecalibrate={onRecalibrate}
        />
      )}
    </div>,
    document.body
  );
}
