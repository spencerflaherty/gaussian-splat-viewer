import { LiquidGlass } from '../ui/LiquidGlass';

export interface ModeSwitcherProps {
  controlMode: 'head' | 'orbit';
  setControlMode: (mode: 'head' | 'orbit') => void;
  visible: boolean;
}

/**
 * Mode Switcher - Pill-shaped toggle for Head Track / Orbit modes
 *
 * Appears at the top center of the viewer.
 */
export function ModeSwitcher({ controlMode, setControlMode, visible }: ModeSwitcherProps) {
  return (
    <div style={{
      position: 'absolute',
      top: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s ease',
      pointerEvents: visible ? 'auto' : 'none',
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
  );
}
