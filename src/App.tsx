import { useState, useEffect, useCallback, useRef } from 'react';
import { useHeadTracking } from './hooks/useHeadTracking';
import { SplatViewer } from './components/viewer/SplatViewer';
import { HUDOverlay } from './components/controls/HUD';
import { DropZone } from './components/upload/DropZone';
import { useSettingsStore, useViewerStore } from './stores';

const HAS_SEEN_SETTINGS_KEY = 'splat-viewer-has-seen-settings';

const STAGE_INFO: Record<string, { label: string; progress: number }> = {
  idle: { label: '', progress: 0 },
  uploading: { label: 'Uploading...', progress: 10 },
  converting: { label: 'Converting to 3D...', progress: 40 },
  loading: { label: 'Rendering...', progress: 80 },
};

const BACKEND_URL = 'http://127.0.0.1:8000';

function App() {
  // Settings store
  const params = useSettingsStore((s) => s.params);

  // Viewer store
  const {
    splatUrl,
    splatFormat,
    fileName,
    controlMode,
    processingStage,
    error,
    showControls,
    showSettings,
    darkBackground,
    backendStatus,
    setSplat,
    setControlMode,
    setProcessingStage,
    setError,
    setShowControls,
    setShowSettings,
    setDarkBackground,
    setBackendStatus,
    reset,
  } = useViewerStore();

  // Head tracking with params from settings store
  const {
    positionRef,
    videoRef,
    calibrationProgress,
    isCalibrated,
    recalibrate,
  } = useHeadTracking(params.smoothing, params.deadZone);

  const hideControlsTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);
  const hasCheckedSettingsRef = useRef(false);
  const [highlightSettings, setHighlightSettings] = useState(false);

  // Show settings panel on first use when entering head tracking mode
  useEffect(() => {
    if (controlMode === 'head' && splatUrl && !hasCheckedSettingsRef.current) {
      hasCheckedSettingsRef.current = true;
      const hasSeenSettings = localStorage.getItem(HAS_SEEN_SETTINGS_KEY);
      if (!hasSeenSettings) {
        // First time user - show settings panel open and highlight it
        setShowSettings(true);
        setHighlightSettings(true);
        localStorage.setItem(HAS_SEEN_SETTINGS_KEY, 'true');
        // Clear highlight after animation completes (3 cycles * 2s = 6s)
        setTimeout(() => setHighlightSettings(false), 6000);
      }
    }
  }, [controlMode, splatUrl, setShowSettings]);

  // Backend health check
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const response = await fetch(`${BACKEND_URL}/`, { method: 'GET', signal: controller.signal });
        clearTimeout(timeoutId);
        setBackendStatus(response.ok ? 'online' : 'offline');
      } catch {
        setBackendStatus('offline');
      }
    };
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    return () => clearInterval(interval);
  }, [setBackendStatus]);

  // Auto-hide controls timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = window.setTimeout(() => {
      if (splatUrl) setShowControls(false);
    }, 3000);
  }, [splatUrl, setShowControls]);

  useEffect(() => {
    if (splatUrl) {
      resetControlsTimer();
      const handleMouseMove = () => resetControlsTimer();
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      };
    }
  }, [splatUrl, resetControlsTimer]);

  // Exit handler
  const handleExit = useCallback(() => {
    reset();
    setShowSettings(false);
    processingRef.current = false;
  }, [reset, setShowSettings]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && splatUrl) handleExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [splatUrl, handleExit]);

  // File processing
  const processFile = async (file: File) => {
    if (processingRef.current || processingStage !== 'idle') return;
    processingRef.current = true;

    setError(null);

    if (file.name.endsWith('.splat')) {
      setProcessingStage('loading');
      setSplat(URL.createObjectURL(file), 'splat', file.name);
    } else if (file.name.endsWith('.ply')) {
      setProcessingStage('loading');
      setSplat(URL.createObjectURL(file), 'ply', file.name);
    } else if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
      if (backendStatus !== 'online') {
        setError('Backend required. Run ./start.sh');
        processingRef.current = false;
        return;
      }

      setProcessingStage('uploading');
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('quality', '100');

        setProcessingStage('converting');
        const response = await fetch(`${BACKEND_URL}/convert`, { method: 'POST', body: formData });

        if (!response.ok) throw new Error(await response.text() || 'Conversion failed');

        setProcessingStage('loading');
        const blob = await response.blob();
        if (blob.size < 1000) throw new Error('Invalid response');

        setSplat(URL.createObjectURL(blob), 'ply', file.name);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Conversion failed');
        setProcessingStage('idle');
        processingRef.current = false;
      }
    } else {
      setError('Unsupported file type');
      processingRef.current = false;
    }
  };

  // Drag-and-drop handlers
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // Splat load callbacks
  const handleSplatLoaded = useCallback(() => {
    setProcessingStage('idle');
    processingRef.current = false;
  }, [setProcessingStage]);

  const handleSplatError = useCallback(
    (msg: string) => {
      setError(msg);
      setProcessingStage('idle');
      processingRef.current = false;
    },
    [setError, setProcessingStage]
  );

  const currentStage = STAGE_INFO[processingStage] || STAGE_INFO.idle;
  const isProcessing = processingStage !== 'idle';

  // Determine background based on state
  const getBackground = () => {
    if (splatUrl) {
      return darkBackground ? '#0a0a0a' : '#ffffff';
    }
    if (isProcessing) {
      return '#ffffff';
    }
    return 'linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #4facfe 100%)';
  };

  return (
    <div
      className="w-full h-screen overflow-hidden relative"
      style={{
        background: getBackground(),
        transition: 'background 0.5s ease',
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <video ref={videoRef} autoPlay playsInline muted className="hidden" style={{ transform: 'scaleX(-1)' }} />

      {!splatUrl ? (
        <DropZone
          isDragOver={isDragOver}
          isProcessing={isProcessing}
          processingLabel={currentStage.label}
          backendStatus={backendStatus}
          error={error}
          onClearError={() => setError(null)}
          fileInputRef={fileInputRef}
          onFileSelect={processFile}
        />
      ) : (
        <div className="absolute inset-0">
          <SplatViewer
            url={splatUrl}
            format={splatFormat}
            headPosition={positionRef}
            controlMode={controlMode}
            headTrackingParams={params}
            onLoaded={handleSplatLoaded}
            onError={handleSplatError}
          />
        </div>
      )}

      {splatUrl && (
        <HUDOverlay
          showControls={showControls}
          controlMode={controlMode}
          setControlMode={setControlMode}
          fileName={fileName}
          splatUrl={splatUrl}
          handleExit={handleExit}
          showSettings={showSettings}
          setShowSettings={setShowSettings}
          darkBackground={darkBackground}
          setDarkBackground={setDarkBackground}
          calibrationProgress={calibrationProgress}
          isCalibrated={isCalibrated}
          onRecalibrate={recalibrate}
          highlightSettings={highlightSettings}
        />
      )}
    </div>
  );
}

export default App;
