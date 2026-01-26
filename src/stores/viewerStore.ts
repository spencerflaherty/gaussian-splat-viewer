import { create } from 'zustand';

export type SplatFormat = 'ply' | 'splat' | null;
export type ControlMode = 'head' | 'orbit';
export type ProcessingStage = 'idle' | 'uploading' | 'converting' | 'loading';
export type BackendStatus = 'checking' | 'online' | 'offline';

interface ViewerState {
  // Splat data
  splatUrl: string | null;
  splatFormat: SplatFormat;
  fileName: string | null;

  // UI state
  controlMode: ControlMode;
  processingStage: ProcessingStage;
  error: string | null;
  showControls: boolean;
  showSettings: boolean;
  darkBackground: boolean;

  // Backend
  backendStatus: BackendStatus;

  // Actions
  setSplat: (url: string | null, format: SplatFormat, fileName?: string | null) => void;
  setControlMode: (mode: ControlMode) => void;
  setProcessingStage: (stage: ProcessingStage) => void;
  setError: (error: string | null) => void;
  setShowControls: (show: boolean) => void;
  setShowSettings: (show: boolean) => void;
  setDarkBackground: (dark: boolean) => void;
  setBackendStatus: (status: BackendStatus) => void;
  reset: () => void;
}

const initialState = {
  splatUrl: null,
  splatFormat: null as SplatFormat,
  fileName: null,
  controlMode: 'orbit' as ControlMode,
  processingStage: 'idle' as ProcessingStage,
  error: null,
  showControls: true,
  showSettings: false,
  darkBackground: true,
  backendStatus: 'checking' as BackendStatus,
};

/**
 * Viewer Store
 *
 * Manages the state of the splat viewer including:
 * - Current splat URL and format
 * - Control mode (head tracking vs orbit)
 * - Processing/loading state
 * - UI visibility state
 */
export const useViewerStore = create<ViewerState>()((set, get) => ({
  ...initialState,

  setSplat: (url, format, fileName = null) => {
    // Revoke previous blob URL to prevent memory leak
    const prevUrl = get().splatUrl;
    if (prevUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(prevUrl);
    }
    set({ splatUrl: url, splatFormat: format, fileName });
  },

  setControlMode: (mode) => set({ controlMode: mode }),
  setProcessingStage: (stage) => set({ processingStage: stage }),
  setError: (error) => set({ error }),
  setShowControls: (show) => set({ showControls: show }),
  setShowSettings: (show) => set({ showSettings: show }),
  setDarkBackground: (dark) => set({ darkBackground: dark }),
  setBackendStatus: (status) => set({ backendStatus: status }),

  reset: () => {
    // Revoke blob URL before reset
    const prevUrl = get().splatUrl;
    if (prevUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(prevUrl);
    }
    set({
      ...initialState,
      backendStatus: get().backendStatus, // Preserve backend status
    });
  },
}));
