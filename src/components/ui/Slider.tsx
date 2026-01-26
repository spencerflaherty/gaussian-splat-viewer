import { useState, type CSSProperties, type ChangeEvent, useRef } from 'react';

export interface SliderProps {
  /** Label to display above the slider */
  label: string;
  /** Current value */
  value: number;
  /** Minimum value */
  min: number;
  /** Maximum value */
  max: number;
  /** Step increment */
  step?: number;
  /** Called when value changes */
  onChange: (value: number) => void;
  /** Number of decimal places for display (default: 2) */
  decimals?: number;
  /** Custom style overrides */
  style?: CSSProperties;
  /** Label for minimum end (e.g., "Subtle") */
  minLabel?: string;
  /** Label for maximum end (e.g., "Dramatic") */
  maxLabel?: string;
  /** Description shown in info tooltip */
  description?: string;
}

/**
 * iOS-style slider with numeric input
 *
 * Displays the ACTUAL value (not offset from default) for clarity.
 * Supports both drag slider and direct numeric input.
 * Optionally shows semantic labels at slider ends.
 */
export function Slider({
  label,
  value,
  min,
  max,
  step = 0.01,
  onChange,
  decimals = 2,
  style,
  minLabel,
  maxLabel,
  description,
}: SliderProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleTextChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val)) {
      const clamped = Math.max(min, Math.min(max, val));
      onChange(clamped);
    }
  };

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(Number(e.target.value));
  };

  // Calculate fill percentage for gradient background
  const fillPercent = ((value - min) / (max - min)) * 100;

  const hasLabels = minLabel || maxLabel;

  return (
    <div style={{ marginBottom: 14, ...style }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <span
            style={{
              fontSize: 13,
              color: 'rgba(0, 0, 0, 0.85)',
              fontWeight: 500,
            }}
          >
            {label}
          </span>
          {description && (
            <>
              <button
                type="button"
                onClick={() => setShowTooltip(!showTooltip)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 8,
                  border: 'none',
                  background: 'rgba(0, 0, 0, 0.08)',
                  color: 'rgba(0, 0, 0, 0.4)',
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'all 0.15s ease',
                }}
              >
                ?
              </button>
              {showTooltip && (
                <div
                  ref={tooltipRef}
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 6,
                    padding: '8px 12px',
                    background: 'rgba(0, 0, 0, 0.85)',
                    color: 'white',
                    fontSize: 11,
                    lineHeight: 1.4,
                    borderRadius: 8,
                    maxWidth: 220,
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  {description}
                </div>
              )}
            </>
          )}
        </div>
        <input
          type="number"
          step={step}
          value={value.toFixed(decimals)}
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
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={handleSliderChange}
        style={{
          width: '100%',
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(to right,
            #007AFF ${fillPercent}%,
            rgba(0,0,0,0.1) ${fillPercent}%)`,
          WebkitAppearance: 'none',
          cursor: 'pointer',
        }}
      />
      {hasLabels && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 4,
          }}
        >
          <span style={{ fontSize: 10, color: 'rgba(0, 0, 0, 0.4)', fontWeight: 500 }}>
            {minLabel || ''}
          </span>
          <span style={{ fontSize: 10, color: 'rgba(0, 0, 0, 0.4)', fontWeight: 500 }}>
            {maxLabel || ''}
          </span>
        </div>
      )}
    </div>
  );
}
