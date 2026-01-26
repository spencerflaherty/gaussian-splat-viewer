import { useState, useEffect, useCallback, useRef } from 'react';
import { useHeadTracking } from './hooks/useHeadTracking';
import { SplatWindow, DEFAULT_HEAD_TRACKING_PARAMS } from './components/SplatWindow';
import { HUDOverlay } from './components/controls/HUD';
import { DropZone } from './components/upload/DropZone';
import type { HeadTrackingParams } from './components/SplatWindow';
import type { BackendStatus } from './components/upload/DropZone';

type ProcessingStage = 'idle' | 'uploading' | 'converting' | 'loading';

const STAGE_INFO: Record<ProcessingStage, { label: string; progress: number }> = {
  idle: { label: '', progress: 0 },
  uploading: { label: 'Uploading...', progress: 10 },
  converting: { label: 'Converting to 3D...', progress: 40 },
  loading: { label: 'Rendering...', progress: 80 },
};

const BACKEND_URL = 'http://127.0.0.1:8000';
const STORAGE_KEY = 'splatWindowSettings_v7';

function loadSavedSettings(): HeadTrackingParams {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_HEAD_TRACKING_PARAMS, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.warn('[App] Failed to load saved settings:', e);
  }
  return DEFAULT_HEAD_TRACKING_PARAMS;
}

function saveSettings(params: HeadTrackingParams): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(params));
  } catch (e) {
    console.error('[App] Failed to save settings:', e);
  }
}

function App() {
  const [headTrackingParams, setHeadTrackingParams] = useState<HeadTrackingParams>(loadSavedSettings);
  const { positionRef, videoRef } = useHeadTracking(
    headTrackingParams.smoothing,
    headTrackingParams.deadZone
  );

  const [splatUrl, setSplatUrl] = useState<string | null>(null);
  const [splatFormat, setSplatFormat] = useState<'ply' | 'splat' | null>(null);
  const [controlMode, setControlMode] = useState<'head' | 'orbit'>('orbit');
  const [processingStage, setProcessingStage] = useState<ProcessingStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [fileName, setFileName] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [showSettings, setShowSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [darkBackground, setDarkBackground] = useState(true);
  const hideControlsTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

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
  }, []);

  // Auto-hide controls timer
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = window.setTimeout(() => {
      if (splatUrl) setShowControls(false);
    }, 3000);
  }, [splatUrl]);

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
    if (splatUrl?.startsWith('blob:')) URL.revokeObjectURL(splatUrl);
    setSplatUrl(null);
    setSplatFormat(null);
    setError(null);
    setFileName(null);
    setProcessingStage('idle');
    setShowSettings(false);
    processingRef.current = false;
  }, [splatUrl]);

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

    setFileName(file.name);
    if (splatUrl?.startsWith('blob:')) URL.revokeObjectURL(splatUrl);
    setError(null);

    if (file.name.endsWith('.splat')) {
      setProcessingStage('loading');
      setSplatFormat('splat');
      setSplatUrl(URL.createObjectURL(file));
    } else if (file.name.endsWith('.ply')) {
      setProcessingStage('loading');
      setSplatFormat('ply');
      setSplatUrl(URL.createObjectURL(file));
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

        setSplatFormat('ply');
        setSplatUrl(URL.createObjectURL(blob));
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
  }, []);

  const handleSplatError = useCallback((msg: string) => {
    setError(msg);
    setProcessingStage('idle');
    processingRef.current = false;
  }, []);

  const currentStage = STAGE_INFO[processingStage];
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
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
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
          <SplatWindow
            url={splatUrl}
            format={splatFormat}
            headPosition={positionRef}
            controlMode={controlMode}
            headTrackingParams={headTrackingParams}
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
          headTrackingParams={headTrackingParams}
          setHeadTrackingParams={setHeadTrackingParams}
          settingsSaved={settingsSaved}
          setSettingsSaved={setSettingsSaved}
          darkBackground={darkBackground}
          setDarkBackground={setDarkBackground}
          onSaveSettings={() => saveSettings(headTrackingParams)}
        />
      )}
    </div>
  );
}

export default App;
