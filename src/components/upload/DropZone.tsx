import type { RefObject } from 'react';
import { LiquidGlass } from '../ui/LiquidGlass';

export type BackendStatus = 'checking' | 'online' | 'offline';

export interface DropZoneProps {
  isDragOver: boolean;
  isProcessing: boolean;
  processingLabel: string;
  backendStatus: BackendStatus;
  error: string | null;
  onClearError: () => void;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileSelect: (file: File) => void;
}

/**
 * DropZone - Upload area for splat files and images
 *
 * Features:
 * - Drag-and-drop handling
 * - Click to browse
 * - Processing spinner
 * - Backend status indicator
 * - Error display
 */
export function DropZone({
  isDragOver,
  isProcessing,
  processingLabel,
  backendStatus,
  error,
  onClearError,
  fileInputRef,
  onFileSelect,
}: DropZoneProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      {/* Header */}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".splat,.ply,image/*,video/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFileSelect(f);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Upload Box */}
      <LiquidGlass
        variant="sidebar"
        className={`cursor-pointer transition-all duration-300 ${isDragOver ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
        style={{ padding: '32px 40px', textAlign: 'center', width: 'auto', display: 'inline-block' }}
      >
        <div onClick={() => !isProcessing && fileInputRef.current?.click()}>
          {!isProcessing ? (
            <>
              {/* Upload Icon */}
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

              {/* Instructions */}
              <p style={{ fontSize: 18, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)', marginBottom: 6 }}>
                {isDragOver ? 'Drop to view' : 'Drop file here'}
              </p>
              <p style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.5)' }}>
                .splat, .ply, or images
              </p>

              {/* Backend Status Indicator */}
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
              {/* Processing Spinner */}
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
                {processingLabel}
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
        </div>
      </LiquidGlass>

      {/* Error Display */}
      {error && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)' }}>
          <LiquidGlass style={{ padding: '12px 20px', borderRadius: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#FF3B30', fontWeight: 500 }}>{error}</span>
              <button
                onClick={onClearError}
                style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.4)', cursor: 'pointer', fontSize: 18 }}
              >
                ×
              </button>
            </div>
          </LiquidGlass>
        </div>
      )}
    </div>
  );
}
