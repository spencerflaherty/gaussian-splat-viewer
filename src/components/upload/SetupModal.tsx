import { useState } from 'react';
import { LiquidGlass } from '../ui/LiquidGlass';

export interface SetupModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Called when user closes the modal */
  onClose: () => void;
}

const INSTALL_COMMAND = 'curl -fsSL https://your-domain.vercel.app/install.sh | bash';

/**
 * SetupModal - Shows installation instructions when backend is offline
 *
 * Displayed when user tries to convert an image but the backend is not running.
 * Provides a copy-able install command for setting up the local backend.
 */
export function SetupModal({ isOpen, onClose }: SetupModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = INSTALL_COMMAND;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <LiquidGlass
          variant="sidebar"
          style={{
            maxWidth: 500,
            width: '100%',
            padding: 32,
            animation: 'slide-up-fade 0.3s ease-out',
          }}
        >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)', margin: 0 }}>
              Backend Required
            </h2>
            <p style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.5)', marginTop: 4 }}>
              Image conversion requires a local backend
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(0, 0, 0, 0.05)',
              border: 'none',
              borderRadius: 8,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 18,
              color: 'rgba(0, 0, 0, 0.4)',
            }}
          >
            ×
          </button>
        </div>

        {/* Explanation */}
        <div style={{
          background: 'rgba(0, 122, 255, 0.08)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
        }}>
          <p style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.7)', margin: 0, lineHeight: 1.6 }}>
            Converting images to 3D gaussian splats requires Apple's SHARP AI model (~2.6GB).
            This runs locally on your Mac for privacy and performance.
          </p>
        </div>

        {/* Install Command */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0, 0, 0, 0.5)', display: 'block', marginBottom: 8 }}>
            Run in Terminal:
          </label>
          <div style={{
            display: 'flex',
            gap: 8,
          }}>
            <div style={{
              flex: 1,
              background: 'rgba(0, 0, 0, 0.05)',
              borderRadius: 10,
              padding: '12px 16px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize: 13,
              color: 'rgba(0, 0, 0, 0.85)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {INSTALL_COMMAND}
            </div>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? 'rgba(52, 199, 89, 0.15)' : 'rgba(0, 122, 255, 0.15)',
                border: 'none',
                borderRadius: 10,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 500,
                color: copied ? '#34C759' : '#007AFF',
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Requirements */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: 'rgba(0, 0, 0, 0.5)', marginBottom: 8 }}>
            Requirements:
          </p>
          <ul style={{
            margin: 0,
            padding: '0 0 0 20px',
            fontSize: 14,
            color: 'rgba(0, 0, 0, 0.6)',
            lineHeight: 1.8,
          }}>
            <li>macOS with Python 3.10+</li>
            <li>~5GB disk space for model</li>
            <li>Internet connection (first run)</li>
          </ul>
        </div>

        {/* Alternative */}
        <div style={{
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          paddingTop: 20,
        }}>
          <p style={{ fontSize: 13, color: 'rgba(0, 0, 0, 0.4)', margin: 0, textAlign: 'center' }}>
            Already have splat files? You can view .splat and .ply files without the backend.
          </p>
        </div>
        </LiquidGlass>
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes slide-up-fade {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
