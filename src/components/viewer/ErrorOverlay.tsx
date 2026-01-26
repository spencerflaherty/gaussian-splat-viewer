export interface ErrorOverlayProps {
  message: string;
}

/**
 * Error Overlay - Displays an error message when scene loading fails
 */
export function ErrorOverlay({ message }: ErrorOverlayProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
      <div className="glass-error rounded-2xl p-8 max-w-md flex flex-col items-center">
        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <div className="text-xl font-medium text-white mb-2">Failed to Load</div>
        <div className="text-sm text-center text-red-300/80">{message}</div>
      </div>
    </div>
  );
}
