import { LiquidGlass } from '../ui/LiquidGlass';
import { Slider } from '../ui/Slider';
import { useSettingsStore } from '../../stores';
import type { HeadTrackingParams } from '../viewer/SplatViewer';

// Slider configuration with actual min/max values and optional semantic labels
const SLIDER_CONFIG: Record<string, {
  min: number;
  max: number;
  step: number;
  label: string;
  minLabel?: string;
  maxLabel?: string;
}> = {
  sensitivity: { min: 0, max: 2.0, step: 0.01, label: 'Sensitivity', minLabel: 'Subtle', maxLabel: 'Dramatic' },
  distance: { min: 0.5, max: 20, step: 0.1, label: 'Distance', minLabel: 'Close', maxLabel: 'Far' },
  screenSize: { min: 0.1, max: 5, step: 0.01, label: 'Screen Size' },
  verticalOffset: { min: -1.0, max: 2.0, step: 0.01, label: 'Vertical Offset' },
  depthSensitivity: { min: 0, max: 2.0, step: 0.01, label: 'Depth Sensitivity', minLabel: 'Off', maxLabel: 'Strong' },
  cameraX: { min: -20, max: 20, step: 0.1, label: 'Camera X' },
  cameraY: { min: -20, max: 20, step: 0.1, label: 'Camera Y' },
  cameraZ: { min: -20, max: 20, step: 0.1, label: 'Camera Z' },
  focusDepth: { min: -50, max: 50, step: 0.1, label: 'Focus Depth' },
  smoothing: { min: 0.01, max: 0.5, step: 0.01, label: 'Smoothing', minLabel: 'Responsive', maxLabel: 'Smooth' },
  deadZone: { min: 0, max: 0.1, step: 0.001, label: 'Dead Zone', minLabel: 'None', maxLabel: 'Large' },
};

// Only use these for numeric params
type NumericParams = Exclude<keyof HeadTrackingParams, 'enableX' | 'enableY' | 'enableZ' | 'invertX' | 'invertY' | 'invertZ'>;

export interface SettingsPanelProps {
  visible: boolean;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  /** Whether to highlight the panel to draw attention (for first-time users) */
  highlight?: boolean;
}

/**
 * Settings Panel - Collapsible sidebar for head tracking parameters
 *
 * Now uses Zustand store for settings with automatic persistence.
 * No manual "Save" button needed - changes are saved automatically.
 */
export function SettingsPanel({
  visible,
  showSettings,
  setShowSettings,
  highlight = false,
}: SettingsPanelProps) {
  // Get settings from store
  const params = useSettingsStore((s) => s.params);
  const updateParam = useSettingsStore((s) => s.updateParam);
  const applyPreset = useSettingsStore((s) => s.applyPreset);
  const reset = useSettingsStore((s) => s.reset);

  // Helper function to render a slider for a parameter
  const renderSlider = (param: NumericParams) => {
    const config = SLIDER_CONFIG[param];
    if (!config) return null;

    const value = params[param] as number;

    return (
      <Slider
        key={param}
        label={config.label}
        value={value}
        min={config.min}
        max={config.max}
        step={config.step}
        onChange={(newValue) => updateParam(param, newValue)}
        minLabel={config.minLabel}
        maxLabel={config.maxLabel}
      />
    );
  };

  return (
    <div style={{
      position: 'absolute',
      top: 70,
      left: 16,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      pointerEvents: visible ? 'auto' : 'none',
      maxHeight: 'calc(100vh - 160px)',
    }}>
      <LiquidGlass
        variant="sidebar"
        className={highlight ? 'animate-attention' : ''}
        style={{ width: 300, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '100%' }}
      >
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
            {/* Presets */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>
                Presets
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['subtle', 'natural', 'dramatic'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => applyPreset(preset)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      borderRadius: 10,
                      border: 'none',
                      background: 'rgba(0, 122, 255, 0.1)',
                      color: '#007AFF',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                      textTransform: 'capitalize',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Axis Toggles */}
            <div style={{ marginBottom: 20, borderTop: '0.5px solid rgba(0, 0, 0, 0.1)', paddingTop: 16 }}>
              <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>
                Tracking Axes
              </div>
              {/* Enable/Disable Row */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                {(['enableX', 'enableY', 'enableZ'] as const).map((axis) => {
                  const labels = { enableX: 'X', enableY: 'Y', enableZ: 'Z' };
                  const descriptions = { enableX: 'Left/Right', enableY: 'Up/Down', enableZ: 'Depth' };
                  const isEnabled = params[axis];
                  return (
                    <button
                      key={axis}
                      onClick={() => updateParam(axis, !params[axis])}
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
                  const isInverted = params[axis];
                  return (
                    <button
                      key={axis}
                      onClick={() => updateParam(axis, !params[axis])}
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

            {/* Reset Button */}
            <div style={{ paddingTop: 8, borderTop: '0.5px solid rgba(0, 0, 0, 0.1)' }}>
              <button
                onClick={reset}
                style={{
                  width: '100%',
                  padding: 12,
                  borderRadius: 10,
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.06)',
                  color: 'rgba(0, 0, 0, 0.6)',
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Reset to Defaults
              </button>
            </div>
          </div>
        )}
      </LiquidGlass>
    </div>
  );
}
