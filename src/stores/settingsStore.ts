import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HeadTrackingParams } from '../components/viewer/SplatViewer';
import { DEFAULT_HEAD_TRACKING_PARAMS } from '../components/viewer/SplatViewer';
import type { RendererSettings } from '../lib/splatRenderer';
import { DEFAULT_RENDERER_SETTINGS } from '../lib/splatRenderer';

/**
 * Presets for head tracking parameters
 *
 * These provide quick starting points for different use cases:
 * - Subtle: Almost no movement, good for static viewing
 * - Natural: Balanced movement, recommended for most users (calibrated defaults)
 * - Dramatic: More pronounced movement for immersive experience
 */
export const PRESETS = {
  subtle: {
    ...DEFAULT_HEAD_TRACKING_PARAMS,
    sensitivity: 0.005,      // Almost no camera movement
    depthSensitivity: 0.02,  // Very subtle zoom
    smoothing: 0.25,         // Very smooth
  },
  natural: {
    ...DEFAULT_HEAD_TRACKING_PARAMS,
    // Uses calibrated defaults (sensitivity: 0.01, depthSensitivity: 0.05)
  },
  dramatic: {
    ...DEFAULT_HEAD_TRACKING_PARAMS,
    sensitivity: 0.05,       // More camera movement
    depthSensitivity: 0.15,  // More zoom effect
    smoothing: 0.1,          // More responsive
  },
} as const;

export type PresetName = keyof typeof PRESETS;

interface SettingsState {
  // Head tracking parameters
  params: HeadTrackingParams;

  // Renderer settings
  rendererSettings: RendererSettings;

  // Actions
  updateParam: <K extends keyof HeadTrackingParams>(key: K, value: HeadTrackingParams[K]) => void;
  updateParams: (updates: Partial<HeadTrackingParams>) => void;
  updateRendererSetting: <K extends keyof RendererSettings>(key: K, value: RendererSettings[K]) => void;
  updateRendererSettings: (updates: Partial<RendererSettings>) => void;
  applyPreset: (preset: PresetName) => void;
  reset: () => void;
  resetRenderer: () => void;
}

/**
 * Settings Store
 *
 * Manages head tracking parameters with automatic localStorage persistence.
 * Changes are saved automatically - no manual "Save" button needed.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      params: DEFAULT_HEAD_TRACKING_PARAMS,
      rendererSettings: DEFAULT_RENDERER_SETTINGS,

      updateParam: (key, value) =>
        set((state) => ({
          params: { ...state.params, [key]: value },
        })),

      updateParams: (updates) =>
        set((state) => ({
          params: { ...state.params, ...updates },
        })),

      updateRendererSetting: (key, value) =>
        set((state) => ({
          rendererSettings: { ...state.rendererSettings, [key]: value },
        })),

      updateRendererSettings: (updates) =>
        set((state) => ({
          rendererSettings: { ...state.rendererSettings, ...updates },
        })),

      applyPreset: (preset) =>
        set({
          params: PRESETS[preset],
        }),

      reset: () =>
        set({
          params: DEFAULT_HEAD_TRACKING_PARAMS,
        }),

      resetRenderer: () =>
        set({
          rendererSettings: DEFAULT_RENDERER_SETTINGS,
        }),
    }),
    {
      name: 'splat-viewer-settings',
      version: 2, // Bump version for new rendererSettings field
    }
  )
);
