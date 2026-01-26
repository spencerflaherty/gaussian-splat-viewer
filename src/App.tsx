import { useState, useEffect, useCallback, useRef } from 'react';
import { useHeadTracking } from './hooks/useHeadTracking';
import { SplatWindow, DEFAULT_HEAD_TRACKING_PARAMS } from './components/SplatWindow';
import { LiquidGlass } from './components/ui/LiquidGlass';
import { HUDOverlay } from './components/controls/HUD';
import type { HeadTrackingParams } from './components/SplatWindow';

type ProcessingStage = 'idle' | 'uploading' | 'converting' | 'loading';
type BackendStatus = 'checking' | 'online' | 'offline';

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
  const [darkBackground, setDarkBackground] = useState(true); // Toggle for viewer background
  const hideControlsTimer = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processingRef = useRef(false);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && splatUrl) handleExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [splatUrl, handleExit]);

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

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
      // Viewing splat - solid color
      return darkBackground ? '#0a0a0a' : '#ffffff';
    }
    if (isProcessing) {
      // Processing - fade to white
      return '#ffffff';
    }
    // Upload screen - gradient
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
        // Upload Screen with colorful background
        <div className="flex flex-col items-center justify-center h-full px-4">
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

          <input
            ref={fileInputRef}
            type="file"
            accept=".splat,.ply,image/*,video/*"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = ''; }}
            className="hidden"
          />

          <LiquidGlass
            variant="sidebar"
            className={`cursor-pointer transition-all duration-300 ${isDragOver ? 'scale-[1.02]' : 'hover:scale-[1.01]'}`}
            style={{ padding: '32px 40px', textAlign: 'center', width: 'auto', display: 'inline-block' }}
          >
            <div onClick={() => !isProcessing && fileInputRef.current?.click()}>
              {!isProcessing ? (
                <>
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
                  <p style={{ fontSize: 18, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)', marginBottom: 6 }}>
                    {isDragOver ? 'Drop to view' : 'Drop file here'}
                  </p>
                  <p style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.5)' }}>
                    .splat, .ply, or images
                  </p>

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
                    {currentStage.label}
                  </p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}
            </div>
          </LiquidGlass>

          {error && (
            <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)' }}>
              <LiquidGlass style={{ padding: '12px 20px', borderRadius: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: '#FF3B30', fontWeight: 500 }}>{error}</span>
                  <button
                    onClick={() => setError(null)}
                    style={{ background: 'none', border: 'none', color: 'rgba(0,0,0,0.4)', cursor: 'pointer', fontSize: 18 }}
                  >
                    ×
                  </button>
                </div>
              </LiquidGlass>
            </div>
          )}
        </div>
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
