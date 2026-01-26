import { LiquidGlass } from '../ui/LiquidGlass';
import { Slider } from '../ui/Slider';
import { useSettingsStore } from '../../stores';
import type { HeadTrackingParams } from '../viewer/SplatViewer';
import type { RendererSettings } from '../../lib/splatRenderer';

// Slider configuration with actual min/max values and optional semantic labels
// Ranges are designed so calibrated defaults sit at sensible midpoints
// This helps users understand "normal" values and how much to adjust
const SLIDER_CONFIG: Record<string, {
  min: number;
  max: number;
  step: number;
  label: string;
  minLabel?: string;
  maxLabel?: string;
  defaultValue?: number; // For reference in UI
}> = {
  // Motion settings - ranges centered around defaults
  // Default sensitivity: 0.01 -> range 0 to 0.02 puts default at 50%
  sensitivity: { min: 0, max: 0.02, step: 0.001, label: 'Movement Scale', minLabel: 'None', maxLabel: 'Strong', defaultValue: 0.01 },
  // Default depthSensitivity: 0.05 -> range 0 to 0.1 puts default at 50%
  depthSensitivity: { min: 0, max: 0.1, step: 0.005, label: 'Zoom Effect', minLabel: 'Off', maxLabel: 'Strong', defaultValue: 0.05 },

  // Camera offsets - ranges centered around defaults
  // Default cameraX: 0.10 -> range -0.4 to 0.6 puts default at 50%
  cameraX: { min: -0.4, max: 0.6, step: 0.01, label: 'X Offset', defaultValue: 0.10 },
  // Default cameraY: 0 -> range -0.5 to 0.5 puts default at 50%
  cameraY: { min: -0.5, max: 0.5, step: 0.01, label: 'Y Offset', defaultValue: 0 },
  // Default cameraZ: -0.50 -> range -1.0 to 0 puts default at 50%
  cameraZ: { min: -1.0, max: 0, step: 0.01, label: 'Z Offset', defaultValue: -0.50 },

  // Smoothing - ranges centered around defaults
  // Default smoothing: 0.15 -> range 0.05 to 0.25 puts default at 50%
  smoothing: { min: 0.05, max: 0.25, step: 0.01, label: 'Smoothing', minLabel: 'Responsive', maxLabel: 'Smooth', defaultValue: 0.15 },
  // Default deadZone: 0.005 -> range 0 to 0.01 puts default at 50%
  deadZone: { min: 0, max: 0.01, step: 0.001, label: 'Dead Zone', minLabel: 'None', maxLabel: 'Large', defaultValue: 0.005 },
};

// Only use these for numeric params
type NumericParams = Exclude<keyof HeadTrackingParams, 'enableX' | 'enableY' | 'enableZ' | 'invertX' | 'invertY' | 'invertZ'>;

// Renderer settings slider configuration
// These affect how splats are rendered (depth perception, size, quality)
const RENDERER_SLIDER_CONFIG: Record<string, {
  min: number;
  max: number;
  step: number;
  label: string;
  minLabel?: string;
  maxLabel?: string;
  defaultValue?: number;
}> = {
  // Focal adjustment - affects perceived depth/size of splats
  // 1.0 = Spark default, 2.0 = match PlayCanvas renderer
  focalAdjustment: { min: 0.5, max: 3.0, step: 0.1, label: 'Focal Adjustment', minLabel: 'Compressed', maxLabel: 'Stretched', defaultValue: 1.0 },
  // Max standard deviation - controls maximum splat size
  // √8 ≈ 2.83 is Spark default
  maxStdDev: { min: 1.0, max: 5.0, step: 0.1, label: 'Splat Size (Max)', minLabel: 'Small', maxLabel: 'Large', defaultValue: Math.sqrt(8) },
  // Blur amount - anti-aliasing for smoother edges
  // 0 = sharp, 0.3 = typical AA, higher = softer
  blurAmount: { min: 0, max: 1.0, step: 0.05, label: 'Edge Blur', minLabel: 'Sharp', maxLabel: 'Soft', defaultValue: 0 },
  // Falloff - splat shape from flat to gaussian
  // 0 = flat disc, 1 = normal gaussian kernel
  falloff: { min: 0, max: 1.0, step: 0.1, label: 'Splat Falloff', minLabel: 'Flat', maxLabel: 'Gaussian', defaultValue: 1.0 },
};

export interface SettingsPanelProps {
  visible: boolean;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
  /** Whether to highlight the panel to draw attention (for first-time users) */
  highlight?: boolean;
  /** Current control mode - hides head tracking settings in orbit mode */
  controlMode?: 'head' | 'orbit';
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
  controlMode = 'head',
}: SettingsPanelProps) {
  const isHeadTrackingMode = controlMode === 'head';
  // Get settings from store
  const params = useSettingsStore((s) => s.params);
  const updateParam = useSettingsStore((s) => s.updateParam);
  const applyPreset = useSettingsStore((s) => s.applyPreset);
  const reset = useSettingsStore((s) => s.reset);

  // Renderer settings from store
  const rendererSettings = useSettingsStore((s) => s.rendererSettings);
  const updateRendererSetting = useSettingsStore((s) => s.updateRendererSetting);
  const resetRenderer = useSettingsStore((s) => s.resetRenderer);

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

  // Helper function to render a slider for renderer settings
  const renderRendererSlider = (param: keyof RendererSettings) => {
    const config = RENDERER_SLIDER_CONFIG[param];
    if (!config) return null;

    const value = rendererSettings[param] as number;

    return (
      <Slider
        key={param}
        label={config.label}
        value={value}
        min={config.min}
        max={config.max}
        step={config.step}
        onChange={(newValue) => updateRendererSetting(param, newValue)}
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
          <div
            className="settings-scroll"
            style={{ padding: 16, overflowY: 'auto', flex: 1, maxHeight: 'calc(100vh - 250px)' }}
          >
            {/* Presets - Only show in head tracking mode */}
            {isHeadTrackingMode && (
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
            )}

            {/* Head Tracking Settings - Only show in head tracking mode */}
            {isHeadTrackingMode && (
              <>
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
                  {renderSlider('depthSensitivity' as NumericParams)}
                </div>

                {/* Offset Section */}
                <div style={{ borderTop: '0.5px solid rgba(0, 0, 0, 0.1)', paddingTop: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>
                    Offset Adjustments
                  </div>
                  <p style={{ fontSize: 11, color: 'rgba(0, 0, 0, 0.4)', marginBottom: 10 }}>
                    Fine-tune the camera position relative to your head
                  </p>
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
              </>
            )}

            {/* Renderer Settings Section */}
            <div style={{ borderTop: '0.5px solid rgba(0, 0, 0, 0.1)', paddingTop: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'rgba(0, 0, 0, 0.4)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 12 }}>
                Rendering
              </div>
              <p style={{ fontSize: 11, color: 'rgba(0, 0, 0, 0.4)', marginBottom: 10 }}>
                Adjust splat appearance and depth perception
              </p>
              {renderRendererSlider('focalAdjustment')}
              {renderRendererSlider('maxStdDev')}
              {renderRendererSlider('blurAmount')}
              {renderRendererSlider('falloff')}
              <button
                onClick={resetRenderer}
                style={{
                  width: '100%',
                  padding: 8,
                  marginTop: 8,
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.04)',
                  color: 'rgba(0, 0, 0, 0.5)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Reset Rendering
              </button>
            </div>

            {/* Reset Button - Only show in head tracking mode */}
            {isHeadTrackingMode && (
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
                  Reset Head Tracking
                </button>
              </div>
            )}
          </div>
        )}
      </LiquidGlass>
    </div>
  );
}
