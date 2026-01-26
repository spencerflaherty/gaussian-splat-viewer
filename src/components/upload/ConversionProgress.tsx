import { useState, useEffect, useRef, useCallback } from 'react';
import { LiquidGlass } from '../ui/LiquidGlass';

export type JobStage = 'uploading' | 'processing' | 'cleaning' | 'downsampling' | 'complete' | 'error';

export interface JobStatus {
  job_id: string;
  stage: JobStage;
  progress: number;
  message: string;
  output_file?: string;
  error?: string;
}

export interface ConversionProgressProps {
  /** File to convert */
  file: File;
  /** Quality setting (5-100) */
  quality: number;
  /** Backend URL */
  backendUrl: string;
  /** Called when conversion completes successfully */
  onComplete: (plyBlob: Blob, jobId: string) => void;
  /** Called when conversion fails or is cancelled */
  onError: (error: string) => void;
  /** Called when user cancels */
  onCancel: () => void;
}

const STAGE_LABELS: Record<JobStage, string> = {
  uploading: 'Uploading...',
  processing: 'Running SHARP AI...',
  cleaning: 'Cleaning PLY...',
  downsampling: 'Optimizing...',
  complete: 'Complete!',
  error: 'Error',
};

const STAGE_ICONS: Record<JobStage, string> = {
  uploading: '📤',
  processing: '🧠',
  cleaning: '🧹',
  downsampling: '📉',
  complete: '✅',
  error: '❌',
};

/**
 * ConversionProgress - Real-time progress display for image-to-splat conversion
 *
 * Connects to the SSE streaming endpoint and displays:
 * - Current stage with icon
 * - Progress bar
 * - Estimated time remaining
 * - Cancel button
 */
export function ConversionProgress({
  file,
  quality,
  backendUrl,
  onComplete,
  onError,
  onCancel,
}: ConversionProgressProps) {
  const [status, setStatus] = useState<JobStatus | null>(null);
  const [startTime] = useState(Date.now());
  const [eta, setEta] = useState<string | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate ETA based on progress
  useEffect(() => {
    if (status && status.progress > 0 && status.progress < 100) {
      const elapsed = Date.now() - startTime;
      const estimated = (elapsed / status.progress) * (100 - status.progress);
      const seconds = Math.ceil(estimated / 1000);

      if (seconds < 60) {
        setEta(`~${seconds}s remaining`);
      } else {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        setEta(`~${mins}m ${secs}s remaining`);
      }
    } else {
      setEta(null);
    }
  }, [status, startTime]);

  // Start conversion on mount
  useEffect(() => {
    const startConversion = async () => {
      try {
        abortControllerRef.current = new AbortController();

        // Upload file and start SSE stream
        const formData = new FormData();
        formData.append('file', file);
        formData.append('quality', quality.toString());

        // Use fetch to POST and get SSE stream
        const response = await fetch(`${backendUrl}/convert-stream`, {
          method: 'POST',
          body: formData,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }

        if (!response.body) {
          throw new Error('No response body');
        }

        // Read SSE stream
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const eventBlock of lines) {
            if (!eventBlock.trim()) continue;

            // Parse SSE event
            const eventMatch = eventBlock.match(/event:\s*(\w+)/);
            const dataMatch = eventBlock.match(/data:\s*(.+)/);

            if (eventMatch && dataMatch) {
              const eventType = eventMatch[1];
              try {
                const data = JSON.parse(dataMatch[1]) as JobStatus;
                jobIdRef.current = data.job_id;
                setStatus(data);

                if (eventType === 'complete') {
                  // Fetch the result
                  const resultResponse = await fetch(
                    `${backendUrl}/job/${data.job_id}/result`
                  );
                  if (!resultResponse.ok) {
                    throw new Error('Failed to download result');
                  }
                  const blob = await resultResponse.blob();
                  onComplete(blob, data.job_id);
                } else if (eventType === 'error') {
                  onError(data.error || 'Conversion failed');
                }
              } catch (parseError) {
                if (import.meta.env.DEV) {
                  console.warn('[ConversionProgress] Parse error:', parseError);
                }
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Cancelled by user
          return;
        }
        onError(err instanceof Error ? err.message : 'Conversion failed');
      }
    };

    startConversion();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [file, quality, backendUrl, onComplete, onError]);

  // Handle cancel
  const handleCancel = useCallback(async () => {
    // Abort the fetch
    abortControllerRef.current?.abort();

    // Cancel the job on backend
    if (jobIdRef.current) {
      try {
        await fetch(`${backendUrl}/job/${jobIdRef.current}/cancel`, {
          method: 'POST',
        });
      } catch {
        // Ignore cancel errors
      }
    }

    onCancel();
  }, [backendUrl, onCancel]);

  const progress = status?.progress ?? 0;
  const stage = status?.stage ?? 'uploading';

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
          Converting Image
        </p>
      </div>

      {/* Progress Card */}
      <LiquidGlass
        variant="sidebar"
        style={{ padding: '32px 40px', textAlign: 'center', minWidth: 320 }}
      >
        {/* Stage Icon */}
        <div style={{
          fontSize: 48,
          marginBottom: 16,
          animation: stage === 'processing' ? 'pulse 2s infinite' : undefined,
        }}>
          {STAGE_ICONS[stage]}
        </div>

        {/* Stage Label */}
        <p style={{
          fontSize: 18,
          fontWeight: 600,
          color: stage === 'error' ? '#FF3B30' : 'rgba(0, 0, 0, 0.85)',
          marginBottom: 8,
        }}>
          {STAGE_LABELS[stage]}
        </p>

        {/* Message */}
        {status?.message && (
          <p style={{
            fontSize: 14,
            color: 'rgba(0, 0, 0, 0.5)',
            marginBottom: 16,
          }}>
            {status.message}
          </p>
        )}

        {/* Progress Bar */}
        {stage !== 'error' && stage !== 'complete' && (
          <div style={{
            width: '100%',
            height: 8,
            background: 'rgba(0, 0, 0, 0.1)',
            borderRadius: 4,
            overflow: 'hidden',
            marginBottom: 12,
          }}>
            <div style={{
              width: `${progress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #007AFF 0%, #5856D6 100%)',
              borderRadius: 4,
              transition: 'width 0.3s ease-out',
            }} />
          </div>
        )}

        {/* Progress Text & ETA */}
        {stage !== 'error' && stage !== 'complete' && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 13,
            color: 'rgba(0, 0, 0, 0.5)',
            marginBottom: 20,
          }}>
            <span>{progress}%</span>
            {eta && <span>{eta}</span>}
          </div>
        )}

        {/* File Info */}
        <div style={{
          padding: '10px 14px',
          background: 'rgba(0, 0, 0, 0.05)',
          borderRadius: 10,
          marginBottom: 20,
        }}>
          <p style={{
            fontSize: 13,
            color: 'rgba(0, 0, 0, 0.6)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {file.name}
          </p>
          <p style={{
            fontSize: 12,
            color: 'rgba(0, 0, 0, 0.4)',
            marginTop: 4,
          }}>
            Quality: {quality}%
          </p>
        </div>

        {/* Cancel Button */}
        {stage !== 'complete' && stage !== 'error' && (
          <button
            onClick={handleCancel}
            style={{
              padding: '10px 24px',
              background: 'rgba(255, 59, 48, 0.1)',
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 500,
              color: '#FF3B30',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 59, 48, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 59, 48, 0.1)';
            }}
          >
            Cancel
          </button>
        )}

        {/* Error Display */}
        {status?.error && (
          <p style={{
            fontSize: 13,
            color: '#FF3B30',
            marginTop: 12,
            padding: '8px 12px',
            background: 'rgba(255, 59, 48, 0.1)',
            borderRadius: 8,
          }}>
            {status.error}
          </p>
        )}
      </LiquidGlass>

      {/* Pulse Animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </div>
  );
}
