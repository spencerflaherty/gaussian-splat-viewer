import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useHeadTracking } from './hooks/useHeadTracking';
import { SplatWindow, DEFAULT_HEAD_TRACKING_PARAMS } from './components/SplatWindow';
import type { HeadTrackingParams } from './components/SplatWindow';

type ProcessingStage = 'idle' | 'uploading' | 'converting' | 'loading';
type BackendStatus = 'checking' | 'online' | 'offline';

const STAGE_INFO: Record<ProcessingStage, { label: string; progress: number }> = {
  idle: { label: '', progress: 0 },
  uploading: { label: 'Uploading...', progress: 10 },
  converting: { label: 'Converting to 3D...', progress: 40 },
  loading: { label: 'Rendering...', progress: 80 },
};

const BACKEND_URL = 'http://127.0.0.1:8000';
const STORAGE_KEY = 'splatWindowSettings_v7';

const SLIDER_CONFIG: Record<string, { range: number; step: number; label: string }> = {
  sensitivity: { range: 2.0, step: 0.01, label: 'Sensitivity' },
  distance: { range: 10, step: 0.01, label: 'Distance' },
  screenSize: { range: 20, step: 0.01, label: 'Screen Size' },
  verticalOffset: { range: 1.0, step: 0.01, label: 'Vertical Offset' },
  depthSensitivity: { range: 2.0, step: 0.01, label: 'Depth Sensitivity' },
  cameraX: { range: 20, step: 0.01, label: 'Camera X' },
  cameraY: { range: 20, step: 0.01, label: 'Camera Y' },
  cameraZ: { range: 20, step: 0.01, label: 'Camera Z' },
  focusDepth: { range: 50, step: 0.01, label: 'Focus Depth' },
  smoothing: { range: 0.5, step: 0.01, label: 'Smoothing' },
  deadZone: { range: 0.1, step: 0.001, label: 'Dead Zone' },
};

// Only use these for numeric params
type NumericParams = Exclude<keyof HeadTrackingParams, 'enableX' | 'enableY' | 'enableZ' | 'invertX' | 'invertY' | 'invertZ'>;

const toSliderValue = (param: NumericParams, actualValue: number): number => {
  const defaultVal = DEFAULT_HEAD_TRACKING_PARAMS[param] as number;
  return Math.round((actualValue - defaultVal) * 1000) / 1000;
};

const fromSliderValue = (param: NumericParams, sliderValue: number): number => {
  const defaultVal = DEFAULT_HEAD_TRACKING_PARAMS[param] as number;
  return Math.round((defaultVal + sliderValue) * 1000) / 1000;
};

function loadSavedSettings(): HeadTrackingParams {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_HEAD_TRACKING_PARAMS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('[App] Failed to load saved settings:', e);
  }
  return DEFAULT_HEAD_TRACKING_PARAMS;
}

function saveSettings(params: HeadTrackingParams): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch (e) {
    console.error('[App] Failed to save settings:', e);
  }
}

// Liquid Glass Panel - Apple iOS 26 style
function LiquidGlass({ children, className = '', style = {}, variant = 'default' }: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'pill' | 'sidebar';
}) {
  const baseStyles: React.CSSProperties = {
    background: variant === 'sidebar'
      ? 'rgba(255, 255, 255, 0.72)'
      : 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(50px) saturate(190%)',
    WebkitBackdropFilter: 'blur(50px) saturate(190%)',
    border: '0.5px solid rgba(255, 255, 255, 0.5)',
    boxShadow: `
      0 2px 20px rgba(0, 0, 0, 0.08),
      0 8px 40px rgba(0, 0, 0, 0.04),
      inset 0 1px 0 rgba(255, 255, 255, 0.8),
      inset 0 -1px 0 rgba(255, 255, 255, 0.2)
    `,
    borderRadius: variant === 'pill' ? 50 : 20,
    ...style,
  };

  return (
    <div className={className} style={baseStyles}>
      {children}
    </div>
  );
}

// HUD Overlay
function HUDOverlay({
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
}: {
  showControls: boolean;
  controlMode: 'head' | 'orbit';
  setControlMode: (mode: 'head' | 'orbit') => void;
  fileName: string | null;
  splatUrl: string;
  handleExit: () => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  headTrackingParams: HeadTrackingParams;
  setHeadTrackingParams: React.Dispatch<React.SetStateAction<HeadTrackingParams>>;
  settingsSaved: boolean;
  setSettingsSaved: (saved: boolean) => void;
  darkBackground: boolean;
  setDarkBackground: (dark: boolean) => void;
}) {
  const renderSlider = (param: NumericParams) => {
    const config = SLIDER_CONFIG[param];
    if (!config) return null;

    const actualValue = headTrackingParams[param] as number;
    const sliderValue = toSliderValue(param, actualValue);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        const clamped = Math.max(-config.range, Math.min(config.range, val));
        setHeadTrackingParams(p => ({ ...p, [param]: fromSliderValue(param, clamped) }));
      }
    };

    return (
      <div key={param} style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 13, color: 'rgba(0, 0, 0, 0.85)', fontWeight: 500 }}>
            {config.label}
          </span>
          <input
            type="number"
            step={config.step}
            value={sliderValue.toFixed(2)}
            onChange={handleTextChange}
            style={{
              width: 70,
              padding: '4px 8px',
              fontSize: 12,
              fontFamily: 'SF Mono, monospace',
              color: 'rgba(0, 0, 0, 0.7)',
              background: 'rgba(0, 0, 0, 0.04)',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              borderRadius: 6,
              textAlign: 'right',
              outline: 'none',
            }}
          />
        </div>
        <input
          type="range"
          min={-config.range}
          max={config.range}
          step={config.step}
          value={sliderValue}
          onChange={(e) => setHeadTrackingParams(p => ({ ...p, [param]: fromSliderValue(param, Number(e.target.value)) }))}
          style={{
            width: '100%',
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(to right,
              #007AFF ${((sliderValue + config.range) / (config.range * 2)) * 100}%,
              rgba(0,0,0,0.1) ${((sliderValue + config.range) / (config.range * 2)) * 100}%)`,
            WebkitAppearance: 'none',
            cursor: 'pointer',
          }}
        />
      </div>
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
                      saveSettings(headTrackingParams);
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

function App() {
  const [headTrackingParams, setHeadTrackingParams] = useState<HeadTrackingParams>(loadSavedSettings);
  const { positionRef, videoRef } = useHeadTracking(
    headTrackingParams.smoothing,
    headTrackingParams.deadZone
  );

  const [splatUrl, setSplatUrl] = useState<string | null>(null);
  const [splatFormat, setSplatFormat] = useState<'ply' | 'splat' | null>(null);
  const [controlMode, setControlMode] = useState<'head' | 'orbit'>('orbit');
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [darkBackground, setDarkBackground] = useState(true); // Toggle for viewer background
  const hideControlsTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(`${BACKEND_URL}/`, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        setBackendStatus(response.ok ? 'online' : 'offline');
      } catch {
        setBackendStatus('offline');
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, []);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = window.setTimeout(() => {
      if (splatUrl) setShowControls(false);
    }, 3000);
  }, [splatUrl]);

  useEffect(() => {
    if (splatUrl) {
      resetControlsTimer();
      const handleMouseMove = () => resetControlsTimer();
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      };
    }
  }, [splatUrl, resetControlsTimer]);

  const handleExit = useCallback(() => {
    if (splatUrl?.startsWith('blob:')) URL.revokeObjectURL(splatUrl);
    setSplatUrl(null);
    setSplatFormat(null);
    setError(null);
    setFileName(null);
    setProcessingStage('idle');
    setShowSettings(false);
    processingRef.current = false;
  }, [splatUrl]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && splatUrl) handleExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [splatUrl, handleExit]);

  const processFile = async (file: File) => {
    if (processingRef.current || processingStage !== 'idle') return;
    processingRef.current = true;

    setFileName(file.name);
    if (splatUrl?.startsWith('blob:')) URL.revokeObjectURL(splatUrl);
    setError(null);

    if (file.name.endsWith('.splat')) {
      setProcessingStage('loading');
      setSplatFormat('splat');
      setSplatUrl(URL.createObjectURL(file));
    } else if (file.name.endsWith('.ply')) {
      setProcessingStage('loading');
      setSplatFormat('ply');
      setSplatUrl(URL.createObjectURL(file));
    } else if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      if (backendStatus !== 'online') {
        setError('Backend required. Run ./start.sh');
        processingRef.current = false;
        return;
      }

      setProcessingStage('uploading');
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('quality', '100');

        setProcessingStage('converting');
        const response = await fetch(`${BACKEND_URL}/convert`, { method: 'POST', body: formData });

        if (!response.ok) throw new Error(await response.text() || 'Conversion failed');

        setProcessingStage('loading');
        const blob = await response.blob();
        if (blob.size < 1000) throw new Error('Invalid response');

        setSplatFormat('ply');
        setSplatUrl(URL.createObjectURL(blob));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Conversion failed');
        setProcessingStage('idle');
        processingRef.current = false;
      }
    } else {
      setError('Unsupported file type');
      processingRef.current = false;
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleSplatLoaded = useCallback(() => {
    setProcessingStage('idle');
    processingRef.current = false;
  }, []);

  const handleSplatError = useCallback((msg: string) => {
    setError(msg);
    setProcessingStage('idle');
    processingRef.current = false;
  }, []);

  const currentStage = STAGE_INFO[processingStage];
  const isProcessing = processingStage !== 'idle';

  // Determine background based on state
  const getBackground = () => {
    if (splatUrl) {
      // Viewing splat - solid color
      return darkBackground ? '#0a0a0a' : '#ffffff';
    }
    if (isProcessing) {
      // Processing - fade to white
      return '#ffffff';
    }
    // Upload screen - gradient
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)';
  };

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{
        background: getBackground(),
        transition: 'background 0.5s ease',
      }}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <video ref={videoRef} autoPlay playsInline muted className="hidden" style={{ transform: 'scaleX(-1)' }} />

      {!splatUrl ? (
        // Upload Screen with colorful background
        <div className="flex flex-col items-center justify-center h-full px-4">
          <div className="mb-10 text-center">
            <h1 style={{
              fontSize: 56,
              fontWeight: 700,
              color: 'white',
              marginBottom: 8,
              textShadow: '0 2px 20px rgba(0,0,0,0.2)',
              letterSpacing: -1,
            }}>
              Splat Window
            </h1>
            <p style={{
              fontSize: 16,
              color: 'rgba(255, 255, 255, 0.8)',
              letterSpacing: 2,
              textTransform: 'uppercase',
              fontWeight: 500,
            }}>
              3D Gaussian Splat Viewer
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".splat,.ply,image/*,video/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
            className="hidden"
          />

          <LiquidGlass
            variant="sidebar"
            className={`cursor-pointer transition-all duration-300 ${isDragOver ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
            style={{ padding: '32px 40px', textAlign: 'center', width: 'auto', display: 'inline-block' }}
          >
            <div onClick={() => !isProcessing && fileInputRef.current?.click()}>
              {!isProcessing ? (
                <>
                  <div style={{
                    width: 64,
                    height: 64,
                    margin: '0 auto 20px',
                    borderRadius: 16,
                    background: 'linear-gradient(135deg, #007AFF 0%, #5856D6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="28" height="28" fill="white" viewBox="0 0 24 24">
                      <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 18, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)', marginBottom: 6 }}>
                    {isDragOver ? 'Drop to view' : 'Drop file here'}
                  </p>
                  <p style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.5)' }}>
                    .splat, .ply, or images
                  </p>

                  <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                      padding: '6px 14px',
                      borderRadius: 20,
                      background: backendStatus === 'online'
                        ? 'rgba(52, 199, 89, 0.15)'
                        : backendStatus === 'checking'
                          ? 'rgba(255, 149, 0, 0.15)'
                          : 'rgba(255, 59, 48, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        background: backendStatus === 'online'
                          ? '#34C759'
                          : backendStatus === 'checking'
                            ? '#FF9500'
                            : '#FF3B30',
                      }} />
                      <span style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: backendStatus === 'online'
                          ? '#34C759'
                          : backendStatus === 'checking'
                            ? '#FF9500'
                            : '#FF3B30',
                      }}>
                        {backendStatus === 'online' ? 'Ready' : backendStatus === 'checking' ? 'Connecting...' : 'Offline'}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div>
                  <div style={{
                    width: 64,
                    height: 64,
                    margin: '0 auto 20px',
                    borderRadius: 32,
                    border: '3px solid rgba(0, 122, 255, 0.2)',
                    borderTopColor: '#007AFF',
                    animation: 'spin 1s linear infinite',
                  }} />
                  <p style={{ fontSize: 16, fontWeight: 500, color: 'rgba(0, 0, 0, 0.7)' }}>
                    {currentStage.label}
                  </p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
            </div>
          </LiquidGlass>

          {error && (
            <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)' }}>
              <LiquidGlass style={{ padding: '12px 20px', borderRadius: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#FF3B30', fontWeight: 500 }}>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.4)', cursor: 'pointer', fontSize: 18 }}
                  >
                    ×
                  </button>
                </div>
              </LiquidGlass>
            </div>
          )}
        </div>
      ) : (
        <div className="absolute inset-0">
          <SplatWindow
            url={splatUrl}
            format={splatFormat}
            headPosition={positionRef}
            controlMode={controlMode}
            headTrackingParams={headTrackingParams}
            onLoaded={handleSplatLoaded}
            onError={handleSplatError}
          />
        </div>
      )}

      {splatUrl && (
        <HUDOverlay
          showControls={showControls}
          controlMode={controlMode}
          setControlMode={setControlMode}
          fileName={fileName}
          splatUrl={splatUrl}
          handleExit={handleExit}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          headTrackingParams={headTrackingParams}
          setHeadTrackingParams={setHeadTrackingParams}
          settingsSaved={settingsSaved}
          setSettingsSaved={setSettingsSaved}
          darkBackground={darkBackground}
          setDarkBackground={setDarkBackground}
        />
      )}
    </div>
  );
}

export default App;
