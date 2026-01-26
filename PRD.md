# Product Requirements Document
## Splat Window: Gaussian Splat Viewer with Head Tracking

**Version:** 2.4 (Camera Transfer & Calibration Flow)
**Author:** Critical Architecture Review
**Date:** January 2025
**Status:** Implementation Complete (Core Features)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [User Personas & Stories](#2-user-personas--stories)
3. [Critical Analysis of Current Implementation](#3-critical-analysis-of-current-implementation)
4. [Technical Specifications](#4-technical-specifications)
5. [Implementation Roadmap](#5-implementation-roadmap)
6. [Risks & Mitigations](#6-risks--mitigations)
7. [Success Metrics](#7-success-metrics)
8. [Appendix: Library Migration](#appendix-library-migration)

---

## 1. Executive Summary

### Problem Statement

Splat Window converts 2D photos into immersive 3D dioramas with webcam-based head tracking, creating a "window into another world" effect. While the core concept is compelling, **the current implementation suffers from architectural debt, poor performance characteristics, and UX friction that undermines the "wow factor" for non-technical users.**

Additionally, the core rendering library (`@mkkellogg/gaussian-splats-3d`) is **no longer maintained** and the author explicitly recommends migration to alternatives.

### Proposed Solution

A ground-up architectural review addressing:
- **50% faster initial load** through code splitting and lazy loading
- **Library migration** from unmaintained `gaussian-splats-3d` to actively maintained `Spark`
- **Real-time conversion feedback** via Server-Sent Events
- **Intuitive settings UX** with presets, auto-save, and guided calibration
- **Mobile-first fallbacks** for gyroscope and touch-based parallax
- **Animation export pipeline** for professional video output with advanced easing options

### Success Criteria

| Metric | Original State | Target | Current State (Jan 2025) |
|--------|----------------|--------|--------------------------|
| Time to First Interaction (splat file) | ~3.5s | <1.5s | Improved (lazy loading) |
| Time to First Interaction (image conversion) | 45-90s (no feedback) | 45-90s (with live progress + ETA) | **ACHIEVED** - SSE streaming |
| Settings Discoverability | <10% find settings | >80% see calibration wizard | **ACHIEVED** - Calibration wizard |
| Mobile Support | 0% | 100% feature parity (with fallbacks) | Infrastructure ready |
| Animation Export | Not available | 1080p/4K MP4 with cubic-bezier easing | Infrastructure ready |
| Core Library Maintenance | Unmaintained | Actively maintained (Spark) | **ACHIEVED** - Migrated to Spark |

---

## 2. User Personas & Stories

### Persona 1: "The Wow Seeker" (Primary)
Regular person who saw a demo, wants to try it with their own photo. Non-technical, expects magic.

### Persona 2: "The Content Creator" (Secondary)
Wants to export high-quality parallax animations from photos for video projects. Needs fine control over camera movements and professional-grade output.

### User Stories

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| US-1 | As a Wow Seeker, I want to drop a photo and see 3D magic within seconds | Progress bar with ETA, no cryptic errors, visible stage indicators |
| US-2 | As a Wow Seeker, I want head tracking to "just work" without configuration | Auto-calibration with visual feedback, sensible presets, one-click options |
| US-3 | As a Wow Seeker, I want to share the experience on my phone | Gyroscope/touch fallbacks, no camera required, adaptive UI |
| US-4 | As a Content Creator, I want to export smooth camera animations | Keyframe editor, cubic-bezier easing curves, 4K export, custom filenames |
| US-5 | As a Content Creator, I want fine-grained control over the effect | Advanced settings with real-time preview, actual values displayed |

### Non-Goals (Scope Protection)

- Multi-view reconstruction (multiple photos -> one splat)
- Real-time video input (webcam -> live splat)
- Cloud-based conversion (keeping SHARP local is intentional)
- Collaborative viewing (shared sessions)
- Analytics or tracking of any kind

---

## 3. Critical Analysis of Current Implementation

> **Note:** This section was written before the January 2025 refactor. Status updates are marked inline.

### 3.1 Critical: Library is Unmaintained - **RESOLVED**

**Original Issue:** The rendering library `@mkkellogg/gaussian-splats-3d` was no longer maintained. The author explicitly recommended migrating to Spark for production use.

**Resolution:** Migrated to `@sparkjsdev/spark` v0.1.10. See `src/lib/splatRenderer.ts` for the adapter implementation.

| Library | Status | Recommendation |
|---------|--------|----------------|
| `@mkkellogg/gaussian-splats-3d` (current) | **NOT MAINTAINED** | Migrate away |
| **Spark** (`@sparkjsdev/spark`) | Active (2025) | **RECOMMENDED** |
| `gsplat.js` | Active (July 2025) | Alternative |
| `antimatter15/splat` | Minimal maintenance | Not recommended |

**Migration Impact:**
- Spark has native Three.js integration (same as current)
- Better mobile support (98%+ WebGL2 coverage)
- Supports more formats: PLY, SPZ, SPLAT, KSPLAT, SOG
- Real-time editing capabilities (future feature potential)
- Skeletal animation support (future feature potential)

**Risk of NOT migrating:** Security vulnerabilities won't be patched, bugs won't be fixed, compatibility with future Three.js versions not guaranteed.

---

### 3.2 Architecture Violations - **RESOLVED**

#### Problem: Monolithic Component Hell - **FIXED**

**Original Issue:** `App.tsx` was **967 lines** containing:
- File handling logic
- Backend communication
- UI state management (23 useState hooks)
- Settings persistence
- Drag-and-drop handling
- Error display
- HUD overlay (250+ lines inline)
- 8 useEffect hooks with complex dependencies

**Impact:** Untestable, unmaintainable, impossible to code-split.

**Resolution:** App.tsx refactored from ~1000 lines to ~290 lines. Components extracted, Zustand stores implemented.

**Old Structure (BAD):**
```
App.tsx (967 lines)
├── LiquidGlass component (inline)
├── Toggle component (inline)
├── HUDOverlay component (inline, 250 lines)
├── renderSlider function (inline)
├── 23 useState hooks
├── 8 useEffect hooks
└── Business logic mixed with presentation
```

**Implemented Structure:**
```
src/
├── components/
│   ├── ui/
│   │   ├── LiquidGlass.tsx        ✅ Implemented
│   │   └── Slider.tsx             ✅ Implemented
│   ├── viewer/
│   │   ├── SplatViewer.tsx        ✅ Implemented
│   │   ├── LoadingOverlay.tsx     ✅ Implemented
│   │   └── ErrorOverlay.tsx       ✅ Implemented
│   ├── controls/
│   │   ├── HUD.tsx                ✅ Implemented
│   │   ├── ModeSwitcher.tsx       ✅ Implemented
│   │   ├── SettingsPanel.tsx      ✅ Implemented
│   │   ├── CalibrationWizard.tsx  ✅ Implemented
│   │   └── KeyframeCapture.tsx    ✅ Implemented
│   └── upload/
│       ├── DropZone.tsx           ✅ Implemented
│       ├── ConversionProgress.tsx ✅ Implemented
│       └── SetupModal.tsx         ✅ Implemented
├── hooks/
│   ├── useHeadTracking.ts         ✅ Implemented
│   ├── useBackendStatus.ts        ✅ Implemented
│   └── useMobileDetection.ts      ✅ Implemented
├── stores/
│   ├── settingsStore.ts           ✅ Implemented (Zustand)
│   ├── viewerStore.ts             ✅ Implemented (Zustand)
│   └── animationStore.ts          ✅ Implemented (Zustand)
└── lib/
    ├── splatRenderer.ts           ✅ Implemented (Spark adapter)
    ├── inputSources.ts            ✅ Implemented
    ├── GyroscopeInput.ts          ✅ Implemented
    └── TouchInput.ts              ✅ Implemented
```

#### Problem: Inline Styles vs Design System Contradiction - **DEFERRED (Low Priority)**

The codebase has a **beautiful CSS design system** in `index.css` (Liquid Glass, `.glass-panel`, `.glass-ultra`, `.glass-btn`, animations, utilities) that is **almost entirely unused**.

**Status:** After audit, decided to keep iOS 26 Light Glass inline styles. The app looks great as-is. Converting 101 inline styles to CSS classes is low ROI - inline styles allow component-level style encapsulation. Deferred to future iteration.

Instead, `App.tsx` has 200+ lines of inline `style={{}}` objects that duplicate and contradict the CSS:

```typescript
// App.tsx lines 74-89 - Inline styles duplicating CSS
const baseStyles: React.CSSProperties = {
  background: variant === 'sidebar'
    ? 'rgba(255, 255, 255, 0.72)'   // iOS 26 light style
    : 'rgba(255, 255, 255, 0.65)',
  backdropFilter: 'blur(50px) saturate(190%)',
  // ... 15 more lines
};
```

Meanwhile in `index.css`:
```css
/* This exists but is barely used! */
.glass-panel {
  background: rgba(22, 22, 30, 0.45);  /* Dark style - contradicts TS */
  backdrop-filter: blur(60px) saturate(220%);
  /* ... complete implementation */
}
```

**Impact:**
- Two different design languages (iOS 26 light in TS, dark glass in CSS)
- Larger bundle size (inline styles not deduplicated)
- Harder to maintain (styling split across TypeScript and CSS)
- Theme switching would require rewriting everything

**Recommendation:** Delete all inline styles, consolidate on CSS classes. Pick ONE design direction (recommend iOS 26 light glass for "wow seeker" appeal).

---

### 3.3 Performance Anti-Patterns - **MOSTLY RESOLVED**

#### Problem: No Lazy Loading - **FIXED**

**Original Issue:** Everything loads upfront, even when unnecessary.

**Resolution:** Added `enabled` param to `useHeadTracking` so MediaPipe only loads when head tracking mode is selected. Existing `initializing` state provides loading feedback.

```typescript
// main.tsx - Eager imports
import { useHeadTracking } from './hooks/useHeadTracking';
// This imports MediaPipe (~2MB WASM) even if user just wants to view a .splat file
```

**Current Load Waterfall:**
```
0ms    - HTML
50ms   - main.tsx bundle (includes ALL code)
200ms  - Three.js (~600KB)
400ms  - gaussian-splats-3d (~200KB)
600ms  - MediaPipe WASM (~2MB) <-- ALWAYS loaded
3500ms - Ready for interaction
```

**Proposed Load Waterfall:**
```
0ms    - HTML + critical CSS
50ms   - Shell bundle (~50KB)
100ms  - Three.js (dynamic import when file dropped)
200ms  - Spark (~150KB, dynamic import)
300ms  - Ready for .splat viewing
         MediaPipe loads ONLY when head tracking mode selected
```

**Implementation:**
```typescript
// Lazy load heavy dependencies
const SplatViewer = lazy(() => import('./components/viewer/SplatViewer'));
const HeadTrackingProvider = lazy(() => import('./providers/HeadTracking'));
```

#### Problem: Always-Running Animation Loops - **FIXED**

**Original Issue:** Two loops ran continuously, even when not needed.

**Resolution:**
- Debug interval removed entirely
- Head tracking RAF only runs when `controlMode === 'head'`
- Cleanup function properly cancels RAF on mode switch

1. **Head tracking camera updates** (`SplatWindow.tsx:474`) - runs even during initial setup
2. **Debug interval** (`SplatWindow.tsx:369`) - logs to console every 500ms FOREVER

```typescript
// Debug loop that never stops - RUNS IN PRODUCTION
useEffect(() => {
  let debugCounter = 0;
  const interval = setInterval(() => {
    debugCounter++;
    if (debugCounter % 10 === 0) {
      console.log('[SplatWindow] Debug tick:', { ... });
    }
  }, 500);
  return () => clearInterval(interval);
}, []); // No dependencies - never stops
```

**Impact:** Battery drain, thermal throttling, console spam, unnecessary CPU cycles.

**Recommendation:**
- Remove debug interval entirely (or gate with `import.meta.env.DEV`)
- Only start head tracking RAF when explicitly in head tracking mode

#### Problem: No Adaptive Quality - **DEFERRED**

**Original Issue:** The viewer always renders at maximum quality.

**Status:** Deferred. Frame rate monitoring with automatic quality adjustment is low priority. Spark renderer settings are now exposed (focalAdjustment, maxStdDev, blurAmount, falloff) for manual quality control.

```typescript
// SplatWindow.tsx:183 - Hardcoded quality settings
const viewer = new GaussianSplats3D.Viewer({
  'antialiased': true,        // Always on
  'gpuAcceleratedSort': false, // Disabled (but this HELPS performance on modern GPUs)
  // No frame rate monitoring
  // No quality reduction when struggling
});
```

**Recommendation:**
- Enable `gpuAcceleratedSort` (faster on modern GPUs)
- Add frame rate monitoring with automatic quality degradation
- Offer presets: "Performance", "Balanced", "Quality"

---

### 3.4 Head Tracking Issues - **RESOLVED**

#### Problem: Invisible Calibration Period - **FIXED**

**Original Issue:** Face width baseline calibration takes 30 frames (~0.5s), but users had NO indication this was happening.

**Resolution:** Calibration Wizard component (`CalibrationWizard.tsx`) added with:
- Visual progress indicator during 30-frame calibration
- "Hold still" instruction
- Recalibrate button

```typescript
// useHeadTracking.ts:129-137
if (baselineFaceWidthRef.current === null) {
  calibrationFramesRef.current.push(currentFaceWidth);
  if (calibrationFramesRef.current.length >= 30) {
    // SILENT calibration - user doesn't know to hold still
    console.log('[HeadTracking] Baseline face width calibrated:', ...);
  }
}
```

**Impact:** Users move during calibration -> bad baseline -> depth tracking feels broken.

**Recommendation:** Add a **Calibration Wizard**:
```
+---------------------------------------+
|  Calibration                          |
|                                       |
|  Hold still for a moment...           |
|  [##########............] 60%         |
|                                       |
|  [Skip]     [Recalibrate]             |
+---------------------------------------+
```

#### Problem: Stale Closure in Camera Update - **FIXED**

**Original Issue:** The `updateCamera` function captured `params` at effect creation.

**Resolution:** Now uses `paramsRef.current` inside RAF callback. Slider changes take immediate effect.

```typescript
// SplatWindow.tsx:474-583
useEffect(() => {
  const updateCamera = () => {
    const { distance, sensitivity, ... } = params;  // STALE if params changes
  };
  // params in deps array, but inner function captures OLD reference
}, [controlMode, loading, headPosition, params]);
```

**Impact:** Slider changes may not immediately affect the camera until mode switch.

**Recommendation:** Use `useRef` for params or extract values inside RAF callback.

#### Problem: Confusing Slider UX - **FIXED**

**Original Issue:** The "centered at zero" design was conceptually elegant but practically confusing.

**Resolution:**
- Sliders now show ACTUAL values, not offsets from default
- Ranges designed so defaults sit at ~50% (intuitive "middle" position)
- Direct text input for precise control
- Semantic labels ("Subtle" / "Dramatic") where appropriate
- One-click presets: Subtle, Natural, Dramatic
- Auto-save on change (no manual save button)
- **Info tooltips**: Each slider has a `?` button explaining what the parameter does

```typescript
// Slider shows "0" but actual value is 2.5
const toSliderValue = (param, actualValue) => {
  const defaultVal = DEFAULT_HEAD_TRACKING_PARAMS[param];
  return actualValue - defaultVal;  // 2.5 - 2.5 = 0 (displayed)
};
```

**User Confusion:**
- Slider shows `0` but actual distance value is `2.5`
- "Sensitivity: 0" means sensitivity is `0.2`, not disabled
- Users expect: 0 = off, positive = more, negative = less

**Recommendation:**
1. Show ACTUAL values, not offsets from default
2. Add semantic labels: "Subtle", "Normal", "Dramatic"
3. Offer one-click presets: "Photo Diorama", "VR Window", "Cinematic"
4. Auto-save on change (no manual save button)

---

### 3.5 Backend Architecture Issues - **RESOLVED**

#### Problem: Synchronous Blocking Conversion - **FIXED**

**Original Issue:** The `/convert` endpoint blocked for 45-90 seconds with no feedback.

**Resolution:** Implemented SSE streaming endpoint `/convert-stream`:
- Parses SHARP stderr for progress
- Yields SSE events with stage and progress updates
- Job management: `/job/{job_id}/result`, `/job/{job_id}/cancel`, `/job/{job_id}/status`
- Frontend `ConversionProgress.tsx` displays real-time progress

```python
# server/main.py:301-306
result = subprocess.run(
    cmd,
    capture_output=True,  # BLOCKS until complete
    text=True,
)
# User sees spinner for 90 seconds with no indication of progress
```

**Impact:**
- No progress feedback
- Server handles only one conversion at a time
- If conversion fails at 90%, user loses all progress with no explanation

**Recommendation:** Implement SSE streaming:
```python
@app.post("/convert-stream")
async def convert_stream(file: UploadFile, quality: int = 15):
    async def generate():
        process = await asyncio.create_subprocess_exec(
            *cmd, stderr=asyncio.subprocess.PIPE
        )
        async for line in process.stderr:
            if progress := parse_sharp_progress(line):
                yield f"data: {json.dumps({'stage': 2, 'progress': progress})}\n\n"
    return StreamingResponse(generate(), media_type="text/event-stream")
```

#### Problem: Temp File Accumulation - **FIXED**

**Original Issue:** No cleanup of temp directories.

**Resolution:** Added `periodic_cleanup` background task that deletes files older than 1 hour from temp directories. Also cleanup after FileResponse sent via BackgroundTasks.

```python
# server/main.py:26-27
UPLOAD_DIR.mkdir(exist_ok=True)
OUTPUT_DIR.mkdir(exist_ok=True)
# Files created here are NEVER deleted
# At 100% quality: ~63MB per conversion
```

**Impact:** Disk fills up over time.

**Recommendation:** Add cleanup after response, or background job for files >1 hour old.

#### Problem: Wildcard CORS

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows ANY origin
)
```

**Recommendation:** Restrict to `localhost` and Vercel domain when deployed.

---

### 3.6 Missing Abstractions for Roadmap Features - **RESOLVED**

**Original Issue:** The architecture could not easily support planned features.

**Resolution:** All abstractions implemented:

| Feature | Original Blocker | Current Status |
|---------|------------------|----------------|
| Mobile Gyroscope | No input source abstraction | ✅ `GyroscopeInput.ts` |
| Touch Parallax | No way to swap input sources | ✅ `TouchInput.ts` |
| Animation Export | No camera interpolation | ✅ `animationStore.ts` with interpolation & easing |
| Streaming Progress | Backend synchronous | ✅ SSE endpoint with `ConversionProgress.tsx` |
| Vercel Deploy | Frontend assumed localhost:8000 | ✅ `useBackendStatus.ts`, `SetupModal.tsx` |

**Recommendation:** Introduce an **Input Source Abstraction**:

```typescript
interface ParallaxInput {
  position: { x: number; y: number; z: number };
  isActive: boolean;
  calibrate(): Promise<void>;
  dispose(): void;
}

// Implementations
class HeadTrackingInput implements ParallaxInput { ... }
class GyroscopeInput implements ParallaxInput { ... }
class TouchDragInput implements ParallaxInput { ... }
class AnimationPlaybackInput implements ParallaxInput { ... }  // For preview/export
```

---

## 4. Technical Specifications

### 4.1 Proposed Architecture

```
+---------------------------------------------------------------------+
|                       FRONTEND (Vite + React)                        |
+---------------------------------------------------------------------+
|                                                                      |
|  +-------------+   +-------------+   +-------------+                 |
|  |   Upload    |   |   Viewer    |   |   Export    |                 |
|  |   Module    |   |   Module    |   |   Module    |                 |
|  +------+------+   +------+------+   +------+------+                 |
|         |                 |                 |                        |
|  +------+-----------------+-----------------+------+                 |
|  |              State Management (Zustand)         |                 |
|  |  - viewerState  - settingsState  - exportState  |                 |
|  +-------------------------+---------------------------+             |
|                            |                                         |
|  +-------------------------+---------------------------+             |
|  |           Input Source Abstraction                  |             |
|  |  +----------+ +----------+ +----------+ +----------+|             |
|  |  |   Head   | |   Gyro   | |  Touch   | |Animation ||             |
|  |  | Tracking | |  Input   | |  Input   | | Playback ||             |
|  |  +----------+ +----------+ +----------+ +----------+|             |
|  +-----------------------------------------------------+             |
|                                                                      |
+---------------------------------------------------------------------+
                              |
                              | HTTP / SSE
                              v
+---------------------------------------------------------------------+
|                  BACKEND (FastAPI - Local Only)                      |
+---------------------------------------------------------------------+
|  /convert-stream (SSE)  |  /health  |  Background Cleanup Task       |
+---------------------------------------------------------------------+
```

### 4.2 State Management (Zustand)

```typescript
// stores/viewerStore.ts
interface ViewerStore {
  // Viewer state
  splatUrl: string | null;
  splatFormat: 'ply' | 'splat' | null;
  isLoading: boolean;
  error: string | null;

  // Control mode
  controlMode: 'head' | 'orbit';
  inputSource: ParallaxInput | null;

  // Settings (auto-persisted)
  settings: Settings;
  activePreset: 'subtle' | 'natural' | 'dramatic' | 'custom';

  // Actions
  loadSplat: (file: File) => Promise<void>;
  setControlMode: (mode: 'head' | 'orbit') => void;
  updateSettings: (partial: Partial<Settings>) => void;
  applyPreset: (preset: string) => void;
}
```

### 4.3 Performance Targets

| Metric | Current | Phase 1 | Phase 2 |
|--------|---------|---------|---------|
| Initial Bundle | ~3MB | <500KB | <300KB |
| TTI (splat file) | 3.5s | 1.5s | <1s |
| Head Tracking FPS | 60 | 60 | 60 (with quality fallback) |
| Memory Usage | Unbounded | <500MB | <300MB (mobile) |
| Conversion Feedback | None | Progress bar | Progress + ETA + Cancel |

### 4.4 Settings UX Overhaul

**Current:** Hidden panel, confusing offset sliders, manual save button.

**Proposed:**

```
+---------------------------------------------------------------+
|  Quick Setup                                                   |
|                                                                |
|  Preset: [Photo Diorama v]                                     |
|                                                                |
|  +---------+  +---------+  +-----------+                       |
|  | Subtle  |  | Natural |  | Dramatic  |   <- One-click        |
|  +---------+  +---------+  +-----------+                       |
|                                                                |
|  [> Advanced Settings]                                         |
|                                                                |
|  +----------------------------------------------------------+  |
|  |  Parallax Intensity                                      |  |
|  |  Subtle  --------[]----------------------  Dramatic      |  |
|  |                   ^ 0.35 (actual value shown)            |  |
|  +----------------------------------------------------------+  |
|                                                                |
|  [Recalibrate Position]          [Reset to Defaults]          |
|                                                                |
|  Auto-save enabled                                             |
+---------------------------------------------------------------+
```

**Key Changes:**
1. Semantic labels - "Subtle" to "Dramatic" instead of numbers
2. Actual values shown - no more offset confusion
3. Auto-save - changes persist immediately, no save button
4. Calibration button - explicit action with visual feedback
5. Info tooltips - `?` button on each slider explains what the parameter does
6. Direct camera controls - Camera Position box (top-right) with editable inputs and up/down ticker buttons
7. Removed offset sliders - replaced by direct camera position control
8. Removed presets - simplified to just show the controls that matter

### 4.5 Animation Export with Advanced Easing

**Easing Options:**
```typescript
type EasingType =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'cubic-bezier';  // Custom curve

interface AnimationConfig {
  start: CameraKeyframe;
  end: CameraKeyframe;
  duration: number;
  easing: EasingType;
  cubicBezier?: [number, number, number, number];  // For custom curves
  resolution: '1080p' | '4k';
  frameRate: 30;
  filename: string;
}
```

**Cubic Bezier Editor UI:**
```
+----------------------------------+
|  Easing: [Cubic Bezier v]        |
|                                  |
|      .----*                      |
|     /      \                     |
|    /        *-----.              |
|   *                              |
|  Start              End          |
|                                  |
|  P1: (0.42, 0.0)  P2: (0.58, 1.0)|
|  [Reset to Ease]                 |
+----------------------------------+
```

---

## 5. Implementation Roadmap

> **Status:** Most phases complete as of January 2025.

### Phase 0: Critical Migration - **COMPLETE**
**Goal:** Replace unmaintained library before building on unstable foundation.

| Task | Status |
|------|--------|
| Evaluate Spark API compatibility | ✅ Complete |
| Migrate from gaussian-splats-3d to Spark | ✅ Complete |
| Verify PLY rotation fix still works | ✅ Complete |
| Test mobile WebGL2 compatibility | ✅ Complete |

### Phase 1: Foundation - **COMPLETE**
**Goal:** Fix what's broken, establish proper architecture.

| Task | Status |
|------|--------|
| Extract components from App.tsx | ✅ Complete (~1000 → ~290 lines) |
| Replace inline styles with CSS classes | ⏸️ Deferred (low priority) |
| Implement Zustand store | ✅ Complete (settings, viewer, animation) |
| Add lazy loading for MediaPipe | ✅ Complete (`enabled` param) |
| Fix stale closure in camera update | ✅ Complete (`paramsRef.current`) |
| Remove debug logging in production | ✅ Complete |
| Add temp file cleanup to backend | ✅ Complete (`periodic_cleanup`) |
| Settings UX overhaul (presets, auto-save) | ✅ Complete |
| Calibration wizard | ✅ Complete |

### Phase 2: Streaming Progress - **COMPLETE**
**Goal:** Conversion no longer feels frozen.

| Task | Status |
|------|--------|
| Implement SSE endpoint `/convert-stream` | ✅ Complete |
| Parse SHARP stderr for progress | ✅ Complete |
| Frontend `ConversionProgress` component | ✅ Complete |
| ETA calculation based on historical data | ⏸️ Basic implementation |
| Cancel button support | ✅ Complete |

### Phase 3: Animation Export - **INFRASTRUCTURE READY**
**Goal:** Content creators can export professional MP4 animations.

| Task | Status |
|------|--------|
| Camera keyframe capture UI | ✅ Complete (`KeyframeCapture.tsx`) |
| SLERP interpolation for smooth rotation | ✅ Complete |
| Preview loop with play/pause | ⏸️ Pending |
| Frame rendering pipeline | ⏸️ Pending |
| ffmpeg.wasm integration (lazy loaded) | ⏸️ Pending |
| Cubic bezier easing editor | ⏸️ Pending (calculation implemented, visual editor pending) |
| Export progress UI | ⏸️ Pending |
| 4K memory optimization | ⏸️ Pending |

### Phase 4: Mobile Support - **INFRASTRUCTURE READY**
**Goal:** Works on phones without camera permission.

| Task | Status |
|------|--------|
| Input source abstraction layer | ✅ Complete (`inputSources.ts`) |
| Gyroscope input implementation | ✅ Complete (`GyroscopeInput.ts`) |
| Touch drag input implementation | ✅ Complete (`TouchInput.ts`) |
| Mobile detection + adaptive UI | ✅ Complete (`useMobileDetection.ts`) |
| Floating camera preview (draggable) | ⏸️ Pending |
| iOS Safari SharedArrayBuffer fallback | ⏸️ Pending |

### Phase 5: Vercel Deployment - **COMPLETE**
**Goal:** Share the viewer publicly, local backend for conversion only.

| Task | Status |
|------|--------|
| Backend status detection + polling | ✅ Complete (`useBackendStatus.ts`) |
| "Viewer Only" mode when backend offline | ✅ Complete |
| Install script (`public/install.sh`) | ✅ Complete |
| Setup modal UI | ✅ Complete (`SetupModal.tsx`) |
| Vercel configuration + headers | ✅ Complete (`vercel.json`) |

---

## 6. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Spark API differs significantly from current lib | Medium | High | Evaluate API before starting; create adapter layer if needed |
| MediaPipe drops iOS Safari support | Low | High | Gyroscope fallback covers mobile use case |
| ffmpeg.wasm too slow for 4K | Medium | Medium | Warn users; default to 1080p; optimize frame batching |
| SHARP model changes output format | Low | Medium | Pin version; add output validation |
| Head tracking feels "wrong" to users | High | High | Presets + calibration wizard + easy reset |
| Zustand adds complexity | Low | Low | Zustand is 1.2KB; simpler than current useState sprawl |

---

## 7. Success Metrics

### Quantitative

| Metric | Measurement Method | Target |
|--------|-------------------|--------|
| Load Performance | Lighthouse Performance Score | >90 |
| Bundle Size | `npm run build` output | <500KB initial |
| Conversion Completion Rate | Backend logs | >95% success |
| Mobile Frame Rate | Chrome DevTools | >30fps on iPhone 12 |

### Qualitative

- **"Wow Factor"**: First-time users audibly react within 5 seconds of viewing
- **"It Just Works"**: Zero configuration needed for basic photo diorama
- **"Professional Output"**: Exported animations are indistinguishable from After Effects

---

## Appendix: Library Migration - **COMPLETE**

### Previous Library: `@mkkellogg/gaussian-splats-3d`

**Status:** NOT MAINTAINED (removed from project)
**Migration Date:** January 2025

### Current Library: Spark (`@sparkjsdev/spark`)

**Status:** Actively maintained (2025)
**GitHub Stars:** 1.6k
**Contributors:** 17 active
**Maintainers:** World Labs + community

**Advantages over current library:**
- Native Three.js integration (same pattern)
- Better mobile support (98%+ WebGL2 coverage)
- More file formats: PLY, SPZ, SPLAT, KSPLAT, SOG
- Real-time editing capabilities
- Skeletal animation support
- GPU shader graphs
- Active bug fixes and security patches

**Migration Results:**
1. ✅ API adapter created (`src/lib/splatRenderer.ts`)
2. ✅ PLY rotation fix preserved (quaternion `[1, 0, 0, 0]`)
3. ✅ Tested with SHARP output files
4. ✅ Off-axis projection working

### Alternative: gsplat.js

**When to consider:** If Spark doesn't meet needs

**Advantages:**
- WASM acceleration
- 92.9% TypeScript
- HuggingFace backing

**Disadvantages:**
- Standalone (not Three.js native)
- Would require significant viewer rewrite

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Jan 2025 | Claude | Initial critical review |
| 2.0 | Jan 2025 | Claude | Implementation complete for core features |
| 2.1 | Jan 2025 | Claude | Updated status for all sections, consolidated with CLAUDE.md |
| 2.2 | Jan 2025 | Claude | Added slider info tooltips, editable camera controls, PLY camera fix, zoom effect fix |
| 2.3 | Jan 2025 | Claude | Simplified settings: removed presets and offset sliders, added up/down ticker buttons to camera inputs |
| 2.4 | Jan 2025 | Claude | Camera transfer: orbit position becomes head tracking baseline after calibration; fixed defaults (deadZone=0, invertX UI logic) |

---

*This PRD documents the January 2025 architecture refactor. Most proposed changes have been implemented. Remaining work (animation export MP4, mobile UI integration) has infrastructure in place and is ready for implementation.*
