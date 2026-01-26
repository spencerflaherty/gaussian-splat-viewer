import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HeadTrackingParams } from '../components/viewer/SplatViewer';
import { DEFAULT_HEAD_TRACKING_PARAMS } from '../components/viewer/SplatViewer';
import type { RendererSettings } from '../lib/splatRenderer';
import { DEFAULT_RENDERER_SETTINGS } from '../lib/splatRenderer';

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
      version: 3, // Bump version for updated defaults (Jan 2025)
    }
  )
);
