import type { Dispatch, SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { LiquidGlass } from '../ui/LiquidGlass';
import { Slider } from '../ui/Slider';
import type { HeadTrackingParams } from '../SplatWindow';
import { DEFAULT_HEAD_TRACKING_PARAMS } from '../SplatWindow';

// Slider configuration with actual min/max values
const SLIDER_CONFIG: Record<string, { min: number; max: number; step: number; label: string }> = {
  sensitivity: { min: 0, max: 2.0, step: 0.01, label: 'Sensitivity' },
  distance: { min: 0.5, max: 20, step: 0.1, label: 'Distance' },
  screenSize: { min: 0.1, max: 5, step: 0.01, label: 'Screen Size' },
  verticalOffset: { min: -1.0, max: 2.0, step: 0.01, label: 'Vertical Offset' },
  depthSensitivity: { min: 0, max: 2.0, step: 0.01, label: 'Depth Sensitivity' },
  cameraX: { min: -20, max: 20, step: 0.1, label: 'Camera X' },
  cameraY: { min: -20, max: 20, step: 0.1, label: 'Camera Y' },
  cameraZ: { min: -20, max: 20, step: 0.1, label: 'Camera Z' },
  focusDepth: { min: -50, max: 50, step: 0.1, label: 'Focus Depth' },
  smoothing: { min: 0.01, max: 0.5, step: 0.01, label: 'Smoothing' },
  deadZone: { min: 0, max: 0.1, step: 0.001, label: 'Dead Zone' },
};

// Only use these for numeric params
type NumericParams = Exclude<keyof HeadTrackingParams, 'enableX' | 'enableY' | 'enableZ' | 'invertX' | 'invertY' | 'invertZ'>;

export interface HUDOverlayProps {
  showControls: boolean;
  controlMode: 'head' | 'orbit';
  setControlMode: (mode: 'head' | 'orbit') => void;
  fileName: string | null;
  splatUrl: string;
  handleExit: () => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  headTrackingParams: HeadTrackingParams;
  setHeadTrackingParams: Dispatch<SetStateAction<HeadTrackingParams>>;
  settingsSaved: boolean;
  setSettingsSaved: (saved: boolean) => void;
  darkBackground: boolean;
  setDarkBackground: (dark: boolean) => void;
  onSaveSettings: () => void;
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
  headTrackingParams,
  setHeadTrackingParams,
  settingsSaved,
  setSettingsSaved,
  darkBackground,
  setDarkBackground,
  onSaveSettings,
}: HUDOverlayProps) {
  // Helper function to render a slider for a parameter
  const renderSlider = (param: NumericParams) => {
    const config = SLIDER_CONFIG[param];
    if (!config) return null;

    const value = headTrackingParams[param] as number;

    return (
      <Slider
        key={param}
        label={config.label}
        value={value}
        min={config.min}
        max={config.max}
        step={config.step}
        onChange={(newValue) => setHeadTrackingParams(p => ({ ...p, [param]: newValue }))}
      />
    );
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 999999, pointerEvents: 'none' }}>

      {/* Top Mode Switcher */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        opacity: showControls ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: showControls ? 'auto' : 'none',
      }}>
        <LiquidGlass variant="pill" style={{ padding: 4, display: 'flex', gap: 2 }}>
          <button
            onClick={() => setControlMode('head')}
            style={{
              padding: '8px 18px',
              borderRadius: 50,
              border: 'none',
              background: controlMode === 'head'
                ? 'rgba(0, 122, 255, 0.9)'
                : 'transparent',
              color: controlMode === 'head' ? 'white' : 'rgba(0, 0, 0, 0.6)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="8" r="4"/>
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6"/>
            </svg>
            Head Track
          </button>
          <button
            onClick={() => setControlMode('orbit')}
            style={{
              padding: '8px 18px',
              borderRadius: 50,
              border: 'none',
              background: controlMode === 'orbit'
                ? 'rgba(0, 122, 255, 0.9)'
                : 'transparent',
              color: controlMode === 'orbit' ? 'white' : 'rgba(0, 0, 0, 0.6)',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>
            </svg>
            Orbit
          </button>
        </LiquidGlass>
      </div>

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
        <div style={{
          position: 'absolute',
          top: 70,
          left: 16,
          opacity: showControls ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: showControls ? 'auto' : 'none',
          maxHeight: 'calc(100vh - 160px)',
        }}>
          <LiquidGlass variant="sidebar" style={{ width: 300, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                width: '100%',
                padding: 16,
                background: 'transparent',
                border: 'none',
                borderBottom: showSettings ? '0.5px solid rgba(0, 0, 0, 0.1)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: 'linear-gradient(180deg, #5AC8FA 0%, #007AFF 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="16" height="16" fill="white" viewBox="0 0 24 24">
                    <path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/>
                  </svg>
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)' }}>Settings</span>
              </div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(0, 0, 0, 0.3)"
                strokeWidth="2.5"
                style={{ transform: showSettings ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s ease' }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showSettings && (
              <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
                {/* Axis Toggles */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>
                    Tracking Axes
                  </div>
                  {/* Enable/Disable Row */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    {(['enableX', 'enableY', 'enableZ'] as const).map((axis) => {
                      const labels = { enableX: 'X', enableY: 'Y', enableZ: 'Z' };
                      const descriptions = { enableX: 'Left/Right', enableY: 'Up/Down', enableZ: 'Depth' };
                      const isEnabled = headTrackingParams[axis];
                      return (
                        <button
                          key={axis}
                          onClick={() => setHeadTrackingParams(p => ({ ...p, [axis]: !p[axis] }))}
                          style={{
                            flex: 1,
                            padding: '10px 8px',
                            borderRadius: 10,
                            border: 'none',
                            background: isEnabled ? 'rgba(0, 122, 255, 0.9)' : 'rgba(0, 0, 0, 0.06)',
                            color: isEnabled ? 'white' : 'rgba(0, 0, 0, 0.5)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <div style={{ fontSize: 16, fontWeight: 700 }}>{labels[axis]}</div>
                          <div style={{ fontSize: 10, opacity: 0.8 }}>{descriptions[axis]}</div>
                        </button>
                      );
                    })}
                  </div>
                  {/* Flip/Invert Row */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(['invertX', 'invertY', 'invertZ'] as const).map((axis) => {
                      const labels = { invertX: 'Flip X', invertY: 'Flip Y', invertZ: 'Flip Z' };
                      const isInverted = headTrackingParams[axis];
                      return (
                        <button
                          key={axis}
                          onClick={() => setHeadTrackingParams(p => ({ ...p, [axis]: !p[axis] }))}
                          style={{
                            flex: 1,
                            padding: '8px 6px',
                            borderRadius: 8,
                            border: 'none',
                            background: isInverted ? 'rgba(255, 149, 0, 0.9)' : 'rgba(0, 0, 0, 0.04)',
                            color: isInverted ? 'white' : 'rgba(0, 0, 0, 0.4)',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {isInverted ? '↔ ' : ''}{labels[axis]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Motion Section */}
                <div style={{ borderTop: '0.5px solid rgba(0, 0, 0, 0.1)', paddingTop: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>
                    Motion
                  </div>
                  {renderSlider('sensitivity' as NumericParams)}
                  {renderSlider('distance' as NumericParams)}
                  {renderSlider('depthSensitivity' as NumericParams)}
                </div>

                {/* View Section */}
                <div style={{ borderTop: '0.5px solid rgba(0, 0, 0, 0.1)', paddingTop: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>
                    View
                  </div>
                  {renderSlider('screenSize' as NumericParams)}
                  {renderSlider('verticalOffset' as NumericParams)}
                  {renderSlider('focusDepth' as NumericParams)}
                </div>

                {/* Camera Offsets Section */}
                <div style={{ borderTop: '0.5px solid rgba(0, 0, 0, 0.1)', paddingTop: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>
                    Camera Offsets
                  </div>
                  {renderSlider('cameraX' as NumericParams)}
                  {renderSlider('cameraY' as NumericParams)}
                  {renderSlider('cameraZ' as NumericParams)}
                </div>

                {/* Smoothing Section */}
                <div style={{ borderTop: '0.5px solid rgba(0, 0, 0, 0.1)', paddingTop: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>
                    Smoothing
                  </div>
                  {renderSlider('smoothing' as NumericParams)}
                  {renderSlider('deadZone' as NumericParams)}
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: 8, paddingTop: 8, borderTop: '0.5px solid rgba(0, 0, 0, 0.1)' }}>
                  <button
                    onClick={() => {
                      onSaveSettings();
                      setSettingsSaved(true);
                      setTimeout(() => setSettingsSaved(false), 2000);
                    }}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 10,
                      border: 'none',
                      background: settingsSaved
                        ? 'linear-gradient(180deg, #34C759 0%, #30B350 100%)'
                        : 'rgba(0, 122, 255, 0.9)',
                      color: 'white',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {settingsSaved ? '✓ Saved' : 'Save'}
                  </button>
                  <button
                    onClick={() => setHeadTrackingParams(DEFAULT_HEAD_TRACKING_PARAMS)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'rgba(0, 0, 0, 0.06)',
                      color: 'rgba(0, 0, 0, 0.6)',
                      fontSize: 14,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            )}
          </LiquidGlass>
        </div>
      )}
    </div>,
    document.body
  );
}
