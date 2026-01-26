export interface LoadingOverlayProps {
  progress: number;
}

/**
 * Loading Overlay - Shows a spinner with progress during scene loading
 */
export function LoadingOverlay({ progress }: LoadingOverlayProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <div className="glass-elevated rounded-2xl p-8 flex flex-col items-center">
        <div className="relative w-20 h-20 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-white/10" />
          <div
            className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
            style={{
              borderTopColor: '#3b82f6',
              borderRightColor: '#8b5cf6',
              animationDuration: '1s'
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-semibold text-gradient-blue">
              {Math.round(progress)}%
            </span>
          </div>
        </div>
        <div className="text-white/60 text-sm">Loading 3D Scene...</div>
      </div>
    </div>
  );
}
