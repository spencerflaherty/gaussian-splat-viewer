# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Table of Contents
1. [Quick Start](#quick-start)
2. [Build & Development Commands](#build--development-commands)
3. [Architecture Overview](#architecture-overview)
4. [Design System (Liquid Glass)](#design-system-liquid-glass)
5. [Core Components](#core-components)
6. [Head Tracking & Parallax Effect](#head-tracking--parallax-effect)
7. [Python Backend (SHARP)](#python-backend-apple-sharp)
8. [Deployment Guide](#deployment-guide)
9. [Known Bugs & Issues](#known-bugs--issues)
10. [Troubleshooting Guide](#troubleshooting-guide)
11. [Future Features / Roadmap](#future-features--roadmap)
12. [Testing](#testing)

---

## Design System (iOS 26 Liquid Glass)

The application features a custom "Liquid Glass" design system inspired by **Apple iOS 26** aesthetics—bright, translucent panels with high blur and subtle borders.

### Core Principles
- **Bright Translucency**: Light, semi-transparent backgrounds (`rgba(255, 255, 255, 0.65-0.72)`)
- **Heavy Blur**: 50px+ backdrop blur with saturation boost (`saturate(190%)`)
- **Subtle Borders**: Thin white borders (`0.5px solid rgba(255, 255, 255, 0.5)`)
- **Layered Shadows**: Multiple soft shadows for depth perception
- **Dynamic Islands**: Floating, pill-shaped controls that sit above content

### LiquidGlass Component (`App.tsx`)
The main glass panel component with variants:
```typescript
// Default panel style
background: 'rgba(255, 255, 255, 0.65)',
backdropFilter: 'blur(50px) saturate(190%)',
border: '0.5px solid rgba(255, 255, 255, 0.5)',
boxShadow: `
  0 2px 20px rgba(0, 0, 0, 0.08),
  0 8px 40px rgba(0, 0, 0, 0.04),
  inset 0 1px 0 rgba(255, 255, 255, 0.8),
  inset 0 -1px 0 rgba(255, 255, 255, 0.2)
`,
borderRadius: 20,

// Sidebar variant (slightly more opaque)
background: 'rgba(255, 255, 255, 0.72)'

// Pill variant (for floating controls)
borderRadius: 50
```

### Key CSS Classes (`index.css`)
| Class | Purpose | Visual Traits |
|-------|---------|---------------|
| `.glass-panel` | Main containers | 60px blur, specular top border, deep shadow |
| `.glass-ultra` | Docks / Pills | 80px blur, high transparency, crisp border |
| `.glass-btn` | Interactive | 20px blur, hover glow, scale animation |
| `.text-gradient` | Headings | White-to-transparent linear gradient |

### Color Tokens
- **Primary**: `#007AFF` (iOS blue) for active states
- **Success**: `#34C759` (iOS green) for enabled toggles
- **Warning**: `#FF9500` (iOS orange) for flip/invert buttons
- **Text Primary**: `rgba(0, 0, 0, 0.85)` (dark text on light glass)
- **Text Secondary**: `rgba(0, 0, 0, 0.5)`

### Animation Tokens
- `animate-float`: Slow, organic vertical floating for background orbs.
- `animate-enter`: Smooth slide-up fade in (`cubic-bezier(0.2, 0.8, 0.2, 1)`).
- `animate-shimmer`: Light reflection effect across glass surfaces.

---

## Quick Start

```bash
# Start both frontend and backend with one command
npm start

# Or use the shell script (auto-installs dependencies)
./start.sh
```

The app will be available at http://localhost:5173 with the backend at http://localhost:8000.

---

## Build & Development Commands

```bash
# Full Stack
npm start        # Start frontend + backend together (recommended)
./start.sh       # Alternative: shell script with auto-setup

# Frontend Only
npm run dev      # Start Vite dev server with HMR (http://localhost:5173)
npm run build    # Type-check with tsc then build with Vite
npm run lint     # Run ESLint
npm run preview  # Preview production build

# Backend Only
npm run backend  # Start Python backend (requires .venv)
# Or manually:
source .venv/bin/activate
python server/main.py  # Server runs on http://0.0.0.0:8000

# Testing
npm run test:e2e # Run Playwright E2E tests
npm run test     # Run Vitest unit tests

# Utilities
npm run clean    # Remove temp_uploads, temp_outputs, dist
```

---

## Architecture Overview

This is a Gaussian Splat viewer with webcam-based head tracking for parallax "window into a virtual world" effects. The app renders 3D Gaussian splat scenes and adjusts the camera based on the user's head position to create the illusion of looking through a window.

### Hybrid Architecture
- **Web Viewer (Vercel)**: Lightweight browser-based viewer for existing .splat/.ply files
- **Generation (Local)**: Heavy compute SHARP model (~2.6GB) runs locally for image-to-splat conversion

### Data Flow
```
User drops file
    |
    v
[App.tsx] File type detection
    |
    +-- .splat/.ply --> Create blob URL --> [SplatWindow]
    |
    +-- Image --> POST /convert --> Backend --> PLY blob --> [SplatWindow]
                                                               |
                                                               v
                                                    gaussian-splats-3d viewer
                                                               |
                                                               v
                                                    [useHeadTracking] --> Off-axis projection
```

### Key Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| `@sparkjsdev/spark` | 0.1.10 | Gaussian splat rendering (migrated from gaussian-splats-3d) |
| `@mediapipe/tasks-vision` | 0.10.32 | Face landmark detection |
| `three` | 0.182.0 | 3D graphics foundation |
| `react` | 19.2.0 | UI framework |
| `zustand` | 5.0.5 | State management |
| `concurrently` | 9.2.1 | Run frontend + backend together |

---

## Core Components

### App.tsx (~290 lines)
Main application component that orchestrates the application. Significantly refactored from ~1000 lines.

**Responsibilities:**
- Drag-and-drop file handling via `DropZone` component
- SSE streaming conversion via `ConversionProgress` component
- Control mode switching (head tracking / orbit)
- Auto-hiding HUD overlay

**State Management:**
All state is now managed via Zustand stores:
- `useSettingsStore` - Head tracking parameters with presets
- `useViewerStore` - Viewer state (splatUrl, format, controlMode, processingStage)
- `useAnimationStore` - Animation keyframes and export settings

### SplatViewer.tsx (~560 lines)
3D viewer component using `@sparkjsdev/spark` (migrated from gaussian-splats-3d).

**Responsibilities:**
- Render Gaussian splat scenes with Three.js
- Implement off-axis projection for parallax window effect
- Apply coordinate system transformations for SHARP PLY files
- Custom render loop for head-tracking camera updates

**Critical Implementation Notes:**

**Viewer Initialization Order** (causes black screen if wrong):
```typescript
// CORRECT - start() after scene loads
viewer.addSplatScene(url, options).then(() => {
    viewer.start();  // Must be inside .then()
});

// WRONG - causes black screen
viewer.addSplatScene(url, options);
viewer.start();  // Too early!
```

**Coordinate System Fix** (SHARP uses OpenCV coordinates):
```typescript
// SHARP PLY files need 180 degree X-axis rotation
// The library expects a quaternion [x, y, z, w], NOT Euler angles
viewer.addSplatScene(url, {
    'rotation': [1, 0, 0, 0]  // Quaternion for 180 deg X-axis rotation
});
```

**Format Codes:** When loading blob URLs, pass format explicitly:
- `format: 0` for .splat files
- `format: 2` for .ply files (SceneFormat enum: 0=Splat, 1=KSplat, 2=Ply, 3=Spz)

### useHeadTracking.ts (~285 lines)
Custom hook for webcam face tracking using MediaPipe with built-in smoothing, dead zone, and **face-width-based depth estimation**.

**Parameters:**
```typescript
useHeadTracking(
    smoothing?: number,  // Exponential smoothing factor (default: 0.15)
    deadZone?: number    // Jitter threshold (default: 0.005)
)
```

**Returns:**
```typescript
{
    position: HeadPosition,                    // Smoothed position for UI
    positionRef: MutableRefObject<SmoothedHeadPosition>,  // Smoothed ref for camera
    rawPositionRef: MutableRefObject<HeadPosition>,       // Raw unsmoothed position
    initializing: boolean,                     // Loading state
    videoRef: RefObject<HTMLVideoElement>      // Video element
}
```

**Features:**
- Frame-rate independent exponential smoothing
- Dead zone to ignore micro-jitter
- Separate raw and smoothed position refs
- Configurable smoothing parameters via props
- **Face-width depth estimation** (more reliable than MediaPipe's Z coordinate)
- Auto-calibration of baseline face width on startup

**Depth Estimation (Face Width Method):**
MediaPipe's native Z coordinate is unreliable for depth (it's relative to head center, not camera distance). Instead, we use **face width** as a proxy:
- Face appears LARGER when closer to camera → positive Z
- Face appears SMALLER when farther from camera → negative Z
- Uses landmarks 234 (left cheek) and 454 (right cheek) for width measurement
- Auto-calibrates baseline from median of first 30 frames
- Reference: [MediaPipe Iris Depth Estimation](https://research.google/blog/mediapipe-iris-real-time-iris-tracking-depth-estimation/)

**Coordinate Mapping:**
- MediaPipe coordinates (0..1) -> NDC (-1..1)
- X: -1 (left) to 1 (right) from viewer's perspective
- Y: -1 (down) to 1 (up) - inverted from MediaPipe
- Z: positive = closer to webcam (based on face width, not MediaPipe Z)

### ErrorBoundary.tsx (57 lines)
React Error Boundary to catch unhandled errors and display a user-friendly error screen with reload button.

### HUD.tsx - Camera Position Debug Box
The HUD includes a **Camera Position Debug Box** in the top-right corner that displays real-time camera coordinates:
- **X, Y, Z**: Current camera position in 3D space
- **Look At**: The target point the camera is facing

This is useful for:
- Calibrating default camera positions
- Debugging scene visibility issues
- Understanding how head tracking affects camera position

The debug box auto-hides with the rest of the HUD controls after 3 seconds of inactivity.

**Data Flow:**
```typescript
// SplatViewer exports CameraPositionData interface
export interface CameraPositionData {
    x: number; y: number; z: number;
    targetX: number; targetY: number; targetZ: number;
}

// SplatViewer calls onCameraPositionUpdate callback
<SplatViewer onCameraPositionUpdate={setCameraPosition} />

// App.tsx threads position to HUD
<HUDOverlay cameraPosition={cameraPosition} />
```

---

## Head Tracking & Parallax Effect

The parallax "window into a virtual world" effect uses off-axis projection to create the illusion that you're looking through a window into a 3D space. As you move your head, the perspective shifts naturally—just like looking through a real window.

### Core Concept

Your screen acts as a virtual window into a 3D scene. The webcam tracks your head position in 3D space, and we use that to adjust the camera frustum asymmetrically. This creates the parallax effect where:
- Objects at the "screen plane" (focusDepth) appear pinned to the screen
- Objects closer appear to pop out
- Objects farther appear behind the glass

### Research Sources
- [MindDock/off-axis-demo](https://github.com/MindDock/off-axis-demo) - Three.js + MediaPipe implementation
- [Johnny Lee's Wii Head Tracking](http://johnnylee.net/projects/wii/) - Original desktop VR concept
- [TheParallaxView](https://www.anxious-bored.com/blog/2018/2/25/theparallaxview-illusion-of-depth-by-3d-head-tracking-on-iphone-x) - iPhone implementation
- [Off-Axis Projection in Unity](https://medium.com/try-creative-tech/off-axis-projection-in-unity-1572d826541e) - Technical explanation

### Head Tracking Parameters

Sliders show **real values** with ranges designed so **defaults sit at ~50%** (the middle). This helps users understand "normal" values and how much to adjust. All sliders support direct text input for precise control.

#### Motion Parameters (Calibrated January 2025)
| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `sensitivity` | **0.01** | 0 - 0.02 | Movement scale. Default at 50% of range |
| `depthSensitivity` | **0.05** | 0 - 0.1 | Zoom effect strength. Default at 50% |

#### Camera Offsets
| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `cameraX` | **0.10** | -0.4 to 0.6 | X offset for scene centering. Default at 50% |
| `cameraY` | **0** | -0.5 to 0.5 | Y offset for scene centering. Default at 50% |
| `cameraZ` | **-0.50** | -1.0 to 0 | Z offset (pull camera back). Default at 50% |

#### Smoothing
| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `smoothing` | **0.15** | 0.05 - 0.25 | Smoothing factor (lower = more responsive). Default at 50% |
| `deadZone` | **0.005** | 0 - 0.01 | Ignore small movements. Default at 50% |

#### Legacy Parameters (kept for compatibility)
| Parameter | Default | Description |
|-----------|---------|-------------|
| `distance` | 2.5 | Base distance (not actively used in camera translation mode) |
| `screenSize` | 0.5 | Virtual screen size (not actively used) |
| `verticalOffset` | 0 | Webcam compensation (not actively used) |
| `focusDepth` | 0 | Screen plane Z coordinate (not actively used) |

#### Axis Controls (UI Toggles)
| Parameter | Default | Description |
|-----------|---------|-------------|
| `enableX` | true | Enable/disable X-axis (left/right) tracking |
| `enableY` | true | Enable/disable Y-axis (up/down) tracking |
| `enableZ` | true | Enable/disable Z-axis (depth) tracking |
| `invertX` | **true** | Flip X-axis direction (calibrated default) |
| `invertY` | **true** | Flip Y-axis direction (calibrated default) |
| `invertZ` | false | Flip Z-axis direction |

The UI provides toggle buttons for each axis:
- **Enable buttons** (blue when active): Turn tracking on/off for each axis
- **Flip buttons** (orange when active): Invert the direction of each axis

**Note:** X and Y axes are flipped by default based on user testing to provide intuitive movement.

### Sensitivity Explained

- **sensitivity < 1.0**: Subtle, cinematic feel
- **sensitivity = 1.0**: 1:1 real-world mapping (recommended default)
- **sensitivity > 1.0**: Exaggerated parallax (can feel disorienting)

Previous implementation used sensitivity=8 which was way too high. The new default of 1.0 provides natural 1:1 mapping.

### Off-Axis Projection Math

The camera uses asymmetric frustum projection instead of standard perspective:

```typescript
// Eye position in screen-space coordinates
const eyeX = (headPos.x * sensitivity * screenSize) + cameraX;
const eyeY = (headPos.y * sensitivity * screenSize) + (verticalOffset * screenSize) + cameraY;
const eyeZ = distance + cameraZ - (headPos.z * depthSensitivity * screenSize);

// Virtual screen dimensions
const screenWidth = screenSize * aspectRatio;
const screenHeight = screenSize;

// Distance from eye to focus plane
const distToFocusPlane = Math.abs(eyeZ - focusDepth);

// Calculate off-axis frustum boundaries
const left   = (-screenWidth/2 - eyeX) * near / distToFocusPlane;
const right  = (screenWidth/2 - eyeX) * near / distToFocusPlane;
const bottom = (-screenHeight/2 - eyeY) * near / distToFocusPlane;
const top    = (screenHeight/2 - eyeY) * near / distToFocusPlane;

// Build projection matrix
camera.projectionMatrix.makePerspective(left, right, top, bottom, near, far);
```

### Smoothing Implementation

The `useHeadTracking` hook applies frame-rate independent exponential smoothing:

```typescript
// Frame-rate independent smoothing
const smoothFactor = Math.min(1, smoothing * deltaTime * 60);
smoothedPos = lerp(smoothedPos, targetPos, smoothFactor);

// Dead zone to reduce micro-jitter
const delta = length(rawPos - lastStablePos);
if (delta > deadZone) {
    lastStablePos = rawPos;
}
```

### Depth Tracking (Face Width Method)

**Why Face Width?**
MediaPipe's native Z-coordinate is unreliable for depth estimation—it represents depth relative to the head's center, not distance from the camera. The standard approach (used by Google's MediaPipe Iris) is to use **face/iris size** as a proxy for distance.

**How It Works:**
1. Measure face width using landmarks 234 (left cheek) and 454 (right cheek)
2. Calibrate a baseline from the median of the first 30 frames
3. Compare current face width to baseline:
   - **Larger face** = closer to camera = **positive Z**
   - **Smaller face** = farther from camera = **negative Z**
4. Normalize the delta and clamp to -1..1 range

**Behavior:**
- Moving **closer** to the webcam (positive Z) zooms in (decreases camera distance)
- Moving **away** from the webcam zooms out (increases camera distance)
- Controlled by `depthSensitivity` (0 = disabled, higher = stronger effect)
- Can be flipped with `invertZ` toggle in UI

**References:**
- [MediaPipe Iris: Real-time Depth Estimation](https://research.google/blog/mediapipe-iris-real-time-iris-tracking-depth-estimation/) - Google's approach using iris size
- The iris method achieves <10% error; face width is slightly less accurate but more robust

### Coordinate System
- Head position is normalized to **-1 to 1** range
- **X**: -1 (left) to 1 (right) from viewer's perspective
- **Y**: -1 (down) to 1 (up)
- **Z**: positive = closer to webcam (based on face width measurement)

---

## Python Backend (Apple SHARP)

The backend converts images to Gaussian splats using Apple's SHARP ML model.

### Python Environment Setup

**IMPORTANT:** Requires Python 3.10+ (ml-sharp uses `str | None` type union syntax)

```bash
# Create venv with Python 3.13 (already done - .venv exists)
/opt/homebrew/opt/python@3.13/bin/python3.13 -m venv .venv

# Activate and install dependencies
source .venv/bin/activate
pip install fastapi uvicorn python-multipart numpy
pip install -r ml-sharp/requirements_mac.txt
pip install -e ml-sharp/
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check - returns `{"status": "ok"}` |
| `/convert` | POST | Convert image to PLY (blocking, for backwards compatibility) |
| `/convert-stream` | POST | Convert image with SSE progress streaming |
| `/job/{job_id}/result` | GET | Download completed conversion result |
| `/job/{job_id}/status` | GET | Get job status |
| `/job/{job_id}/cancel` | POST | Cancel a running job |

**POST /convert-stream (Recommended):**
- Request: `multipart/form-data` with `file` (image) and `quality` (5-100)
- Response: SSE stream with progress events:
  - `event: progress` - Stage and progress updates
  - `event: complete` - Job finished with `job_id` to fetch result
  - `event: error` - Conversion failed
- Final result fetched via `/job/{job_id}/result`

**POST /convert (Legacy):**
- Request: `multipart/form-data` with `file` (image) and `quality` (5-100)
- Response: Binary PLY file (`application/octet-stream`)
- Quality is clamped to [5, 100] range

### SHARP Model

- **Model URL:** https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt
- **Size:** 2.62GB
- **Cache:** `~/.cache/torch/hub/checkpoints/`
- **Auto-downloads** on first `sharp predict` command
- **Disk requirement:** ~5GB free (parallel download streams + temp files)

### PLY Processing Pipeline

1. **SHARP Conversion**: Image -> raw PLY with extra metadata
2. **PLY Cleaning**: Strip incompatible elements (`clean_ply_for_viewer()`)
3. **Downsampling**: Reduce splat count based on quality setting (`downsample_ply()`)

**PLY Cleaning (Critical):**
SHARP outputs PLY files with extra metadata elements that `gaussian-splats-3d` cannot parse:
- `element extrinsic`, `element intrinsic`, `element image_size`, `element frame`, `element disparity`, `element color_space`, `element version`

The `clean_ply_for_viewer()` function strips these, keeping only `element vertex` with 14 gaussian splat properties:
```
x, y, z, f_dc_0, f_dc_1, f_dc_2, opacity, scale_0, scale_1, scale_2, rot_0, rot_1, rot_2, rot_3
```

### Quality vs File Size

| Quality | Vertices | File Size | Use Case |
|---------|----------|-----------|----------|
| 5% (Fast) | ~59,000 | ~3MB | Quick preview |
| 15% (Balanced) | ~177,000 | ~10MB | Good balance |
| 40% (High) | ~472,000 | ~26MB | High detail |
| 100% (Ultra) | ~1.18M | ~63MB | Maximum fidelity |

---

## Deployment Guide

### Web Viewer (Vercel)

The React/Vite frontend can be deployed to Vercel for public access.

**To Deploy:**
1. Push code to GitHub
2. Import project into Vercel
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Install Command: `npm install`

**Note:** Image-to-splat conversion will NOT work on Vercel unless you configure a separate GPU backend.

### Local Development

```bash
# Recommended: Start both servers together
npm start

# Or separately:
npm run dev      # Frontend: http://localhost:5173
npm run backend  # Backend: http://localhost:8000
```

### CORS Headers

The `vite.config.ts` must include headers for SharedArrayBuffer:
```typescript
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  },
}
```

---

## Known Bugs & Issues

### FIXED (January 2025)

| Bug | Location | Status |
|-----|----------|--------|
| Race condition in file processing | `App.tsx` | **FIXED** - Added `processingRef` |
| RAF memory leak in head tracking | `SplatWindow.tsx` | **FIXED** - Cancel RAF at start of effect |
| Missing try-catch on viewer.start() | `SplatWindow.tsx` | **FIXED** - Wrapped in try-catch |
| EventListener memory leak | `useHeadTracking.ts` | **FIXED** - Added `{ once: true }` |
| Camera permission handling | `useHeadTracking.ts` | **FIXED** - Added error messages |
| Settings panel not reset on exit | `App.tsx` | **FIXED** - Added `setShowSettings(false)` |
| Weak head tracking sensitivity | Defaults | **FIXED** - Recalibrated defaults from user testing |
| Y-axis inverted | `SplatWindow.tsx` | **FIXED** - Negated Y in camera calculation |
| **Depth (Z) tracking not working** | `useHeadTracking.ts` | **FIXED** - Replaced MediaPipe Z with face-width measurement |
| No axis flip controls | `App.tsx` | **FIXED** - Added invertX/Y/Z toggles |
| Slider precision too coarse | `App.tsx` | **FIXED** - Changed to 0.01 step with text input |

### Remaining Issues

| Bug | Description | Priority |
|-----|-------------|----------|
| Backend error validation | HTML error pages displayed as-is | LOW |
| Bounding box fails silently | Empty geometry returns (0,0,0) | LOW |

**Fixed in January 2025 Refactor:**
- Stale closure in updateCamera - Now uses `paramsRef.current` in RAF callback
- Camera state validation - Added proper checks before operations

---

## Troubleshooting Guide

### Quick Reference Table

| Symptom | Most Likely Cause | Solution |
|---------|------------------|----------|
| Black screen, no errors | `viewer.start()` timing | Ensure start() is inside `.then()` |
| Black screen, console errors | WebGL context issue | Check WebGL2 support, verify format code |
| Scene upside-down | Rotation not applied | Add `rotation: [1, 0, 0, 0]` for PLY |
| Scene not visible | Camera position wrong | Try orbit controls to find scene |
| Scene appears very small | Camera too far from content | Use scroll wheel to zoom in, or click Center View button |
| Head tracking weak | Old settings in localStorage | Run `localStorage.removeItem('splat-viewer-settings')` |
| Backend conversion fails | Server not running | Run `npm start` or `npm run backend` |
| Head tracking doesn't work | Camera denied | Check browser permissions |
| Depth (Z) not working | Calibration needed | Wait 1-2 seconds for baseline calibration; check console for "Baseline face width calibrated" |
| Axis movement reversed | Need to flip axis | Use Flip X/Y/Z buttons in Settings panel |
| Conversion stuck at 80% | SHARP still processing | This is normal - SHARP takes 60-120s for large images |
| "Separator not found" error | SSE stream issue | Retry the conversion; may be a network hiccup |

### Console Message Sequence (Successful Load)

```
[SplatWindow] Initializing viewer...
[SplatWindow] URL: blob:http://...
[SplatWindow] Format: ply
[SplatWindow] Viewer created successfully
[SplatWindow] Applying rotation for PLY format (quaternion: [1, 0, 0, 0])
[SplatWindow] Scene loaded successfully
[SplatWindow] Splat count: 175000
[SplatWindow] Viewer started
[HeadTracking] Video playback started
[HeadTracking] Baseline face width calibrated: 0.4523  // Depth tracking ready!
```

### Backend Troubleshooting

| Issue | Solution |
|-------|----------|
| "No module named sharp.cli.__main__" | `pip install -e ml-sharp/` |
| Python version error | Need Python 3.10+, use the .venv |
| Disk space error | Need ~5GB free space |
| Port 8000 in use | `lsof -ti :8000 \| xargs kill -9` |

### Diagnostic Commands

```bash
# Check backend health
curl -s http://127.0.0.1:8000/

# Clear saved settings (to get new defaults)
# In browser console:
localStorage.removeItem('splatWindowSettings_v7')

# Check WebGL2 support (in browser console)
!!document.createElement('canvas').getContext('webgl2')

# Check SharedArrayBuffer (in browser console)
self.crossOriginIsolated
```

---

## Future Features / Roadmap

### Implemented (January 2025)
- **SSE Streaming Progress**: Real-time conversion progress with cancel support ✅
- **Vercel Deployment Ready**: vercel.json config, COOP/COEP headers, install.sh ✅
- **Mobile Input Sources**: Gyroscope and touch drag input abstraction ✅
- **Animation Infrastructure**: Keyframe capture, interpolation, easing functions ✅
- **State Management**: Zustand stores for settings, viewer, and animation ✅
- **Calibration Wizard**: Visual feedback during head tracking calibration ✅
- **Settings Presets**: Subtle, Natural, Dramatic one-click presets ✅
- **Camera Position Debug Box**: Real-time display of camera X/Y/Z coordinates and target point ✅
- **Slider Ranges Centered**: All sliders have ranges where defaults sit at ~50% for intuitive adjustment ✅
- **Install Script Auto-Run**: `curl | bash` installer now auto-starts the app ✅

### Planned Features
- **Animation Export (MP4)**: ffmpeg.wasm integration for video export
- **Preview Loop**: Animation preview playback in viewer
- **Cubic Bezier Editor**: Visual easing curve editor
- **Video Support**: Upload video -> extract frames -> generate 3D splat
- **Multi-View**: Construct splats from multiple images or video frames

### Deferred
- **CSS Class Consolidation**: 101 inline styles work well, low ROI to migrate
- **Adaptive Quality**: Frame rate monitoring with auto quality adjustment

---

## Testing

### Test Structure
```
e2e/
  viewer.spec.ts        # Page load, UI elements, console monitoring

src/__tests__/          # Unit tests (planned)
  App.test.tsx
  SplatWindow.test.tsx
  useHeadTracking.test.ts
```

### Running Tests

```bash
# E2E tests (Playwright)
npm run test:e2e

# Unit tests (Vitest)
npm run test
```

---

## File Structure

```
/
├── src/
│   ├── main.tsx                    # React entry point
│   ├── App.tsx                     # Main application (~290 lines, refactored)
│   ├── index.css                   # Glassmorphism design system
│   ├── components/
│   │   ├── ErrorBoundary.tsx       # Error handling
│   │   ├── ui/
│   │   │   ├── LiquidGlass.tsx     # iOS 26 glass panel component
│   │   │   └── Slider.tsx          # Parameter slider with text input
│   │   ├── viewer/
│   │   │   ├── SplatViewer.tsx     # 3D viewer (~560 lines)
│   │   │   ├── LoadingOverlay.tsx  # Loading spinner
│   │   │   └── ErrorOverlay.tsx    # Error display
│   │   ├── controls/
│   │   │   ├── HUD.tsx             # Heads-up display overlay
│   │   │   ├── ModeSwitcher.tsx    # Head/Orbit mode toggle
│   │   │   ├── SettingsPanel.tsx   # Parameter controls
│   │   │   ├── CalibrationWizard.tsx # Head tracking calibration
│   │   │   └── KeyframeCapture.tsx # Animation keyframe UI
│   │   └── upload/
│   │       ├── DropZone.tsx        # File drag-and-drop
│   │       ├── ConversionProgress.tsx # SSE progress display
│   │       └── SetupModal.tsx      # Backend installation instructions
│   ├── hooks/
│   │   ├── useHeadTracking.ts      # Face tracking with MediaPipe
│   │   ├── useBackendStatus.ts     # Backend health polling
│   │   └── useMobileDetection.ts   # Device capability detection
│   ├── stores/
│   │   ├── index.ts                # Store exports
│   │   ├── settingsStore.ts        # Head tracking params + presets
│   │   ├── viewerStore.ts          # Viewer state
│   │   └── animationStore.ts       # Animation keyframes + easing
│   └── lib/
│       ├── splatRenderer.ts        # Spark adapter
│       ├── inputSources.ts         # ParallaxInput interface
│       ├── GyroscopeInput.ts       # Gyroscope-based parallax
│       └── TouchInput.ts           # Touch/mouse drag parallax
├── server/
│   ├── main.py                     # FastAPI backend (~750 lines)
│   └── requirements.txt            # Python dependencies
├── e2e/
│   └── viewer.spec.ts              # Playwright tests
├── public/
│   ├── install.sh                  # Backend installer script
│   └── samples/                    # Test files
├── ml-sharp/                       # Apple SHARP submodule
├── temp_uploads/                   # Uploaded images (gitignored)
├── temp_outputs/                   # Converted PLYs (gitignored)
├── vercel.json                     # Vercel deployment config
├── start.sh                        # Shell launcher script
├── package.json                    # NPM config with scripts
├── vite.config.ts                  # Vite configuration
├── tsconfig.json                   # TypeScript configuration
├── CLAUDE.md                       # This file
├── PRD.md                          # Product Requirements Document
├── EXECUTION_PLAN.md               # Refactor execution plan
└── feature_improvements.md         # Feature roadmap
```
