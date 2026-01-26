import { useState, useEffect, useCallback } from 'react';

export type BackendStatus = 'checking' | 'online' | 'offline';

interface UseBackendStatusOptions {
  /** Backend URL to check */
  url?: string;
  /** Polling interval in milliseconds (default: 5000) */
  pollInterval?: number;
  /** Timeout for health check requests (default: 2000) */
  timeout?: number;
}

interface UseBackendStatusReturn {
  /** Current backend status */
  status: BackendStatus;
  /** Check backend status immediately */
  checkNow: () => Promise<void>;
  /** Whether the backend is available */
  isOnline: boolean;
  /** Whether we're still checking */
  isChecking: boolean;
}

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8000';
const DEFAULT_POLL_INTERVAL = 5000;
const DEFAULT_TIMEOUT = 2000;

/**
 * Hook to monitor backend server status
 *
 * Features:
 * - Polls backend health endpoint at regular intervals
 * - Returns status: 'checking', 'online', or 'offline'
 * - Provides manual checkNow function for immediate status check
 * - Configurable URL, poll interval, and timeout
 */
export function useBackendStatus(options: UseBackendStatusOptions = {}): UseBackendStatusReturn {
  const {
    url = DEFAULT_BACKEND_URL,
    pollInterval = DEFAULT_POLL_INTERVAL,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  const [status, setStatus] = useState<BackendStatus>('checking');

  const checkBackend = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(`${url}/`, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      setStatus(response.ok ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
  }, [url, timeout]);

  // Initial check and polling
  useEffect(() => {
    // Check immediately on mount
    checkBackend();

    // Set up polling interval
    const interval = setInterval(checkBackend, pollInterval);

    return () => clearInterval(interval);
  }, [checkBackend, pollInterval]);

  return {
    status,
    checkNow: checkBackend,
    isOnline: status === 'online',
    isChecking: status === 'checking',
  };
}
