import type { CSSProperties, ReactNode } from 'react';

export interface LiquidGlassProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  variant?: 'default' | 'pill' | 'sidebar';
}

/**
 * Liquid Glass Panel - Apple iOS 26 style
 *
 * A glassmorphism component with bright translucent backgrounds,
 * heavy blur, and subtle borders.
 *
 * Variants:
 * - default: Standard panel (72% white, 50px blur)
 * - pill: Rounded pill shape for floating controls
 * - sidebar: Slightly more opaque for side panels
 */
export function LiquidGlass({
  children,
  className = '',
  style = {},
  variant = 'default',
}: LiquidGlassProps) {
  const baseStyles: CSSProperties = {
    background:
      variant === 'sidebar'
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
