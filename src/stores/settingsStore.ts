import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { HeadTrackingParams } from '../components/viewer/SplatViewer';
import { DEFAULT_HEAD_TRACKING_PARAMS } from '../components/viewer/SplatViewer';

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

  // Actions
  updateParam: <K extends keyof HeadTrackingParams>(key: K, value: HeadTrackingParams[K]) => void;
  updateParams: (updates: Partial<HeadTrackingParams>) => void;
  applyPreset: (preset: PresetName) => void;
  reset: () => void;
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

      updateParam: (key, value) =>
        set((state) => ({
          params: { ...state.params, [key]: value },
        })),

      updateParams: (updates) =>
        set((state) => ({
          params: { ...state.params, ...updates },
        })),

      applyPreset: (preset) =>
        set({
          params: PRESETS[preset],
        }),

      reset: () =>
        set({
          params: DEFAULT_HEAD_TRACKING_PARAMS,
        }),
    }),
    {
      name: 'splat-viewer-settings',
      version: 1,
    }
  )
);
