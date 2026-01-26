export { useSettingsStore } from './settingsStore';

// Re-export renderer settings types from lib for convenience
export { DEFAULT_RENDERER_SETTINGS } from '../lib/splatRenderer';
export type { RendererSettings } from '../lib/splatRenderer';

export { useViewerStore } from './viewerStore';
export type { SplatFormat, ControlMode, ProcessingStage, BackendStatus } from './viewerStore';

export {
  useAnimationStore,
  interpolateKeyframes,
  applyEasing,
  RESOLUTION_PRESETS,
} from './animationStore';
export type {
  CameraKeyframe,
  EasingType,
  BezierControlPoints,
  ResolutionPreset,
} from './animationStore';
