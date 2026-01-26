import { useState, useEffect } from 'react';
import { detectCapabilities, getRecommendedInputSource, type InputCapabilities } from '../lib/inputSources';

export type InputSourceType = 'head' | 'gyroscope' | 'touch';

interface UseMobileDetectionReturn {
  /** Detected device capabilities */
  capabilities: InputCapabilities | null;
  /** Whether detection is still running */
  isDetecting: boolean;
  /** Recommended input source for this device */
  recommendedSource: InputSourceType;
  /** Whether the device is mobile */
  isMobile: boolean;
  /** Whether gyroscope is available */
  hasGyroscope: boolean;
  /** Whether webcam is available */
  hasWebcam: boolean;
  /** Whether touch is available */
  hasTouch: boolean;
}

/**
 * Hook to detect device capabilities and recommend an input source
 *
 * Features:
 * - Detects webcam, gyroscope, and touch availability
 * - Identifies mobile vs desktop devices
 * - Recommends the best input source for the device
 */
export function useMobileDetection(): UseMobileDetectionReturn {
  const [capabilities, setCapabilities] = useState<InputCapabilities | null>(null);
  const [isDetecting, setIsDetecting] = useState(true);

  useEffect(() => {
    let mounted = true;

    const detect = async () => {
      try {
        const caps = await detectCapabilities();
        if (mounted) {
          setCapabilities(caps);
          setIsDetecting(false);

          if (import.meta.env.DEV) {
            console.log('[useMobileDetection] Capabilities:', caps);
            console.log('[useMobileDetection] Recommended:', getRecommendedInputSource(caps));
          }
        }
      } catch (error) {
        if (mounted) {
          console.error('[useMobileDetection] Detection failed:', error);
          // Set default capabilities on error
          setCapabilities({
            hasWebcam: false,
            hasGyroscope: false,
            hasTouch: true,
            isMobile: false,
          });
          setIsDetecting(false);
        }
      }
    };

    detect();

    return () => {
      mounted = false;
    };
  }, []);

  // Derive values from capabilities
  const recommendedSource = capabilities
    ? (getRecommendedInputSource(capabilities) as InputSourceType)
    : 'touch';

  return {
    capabilities,
    isDetecting,
    recommendedSource,
    isMobile: capabilities?.isMobile ?? false,
    hasGyroscope: capabilities?.hasGyroscope ?? false,
    hasWebcam: capabilities?.hasWebcam ?? false,
    hasTouch: capabilities?.hasTouch ?? true,
  };
}
