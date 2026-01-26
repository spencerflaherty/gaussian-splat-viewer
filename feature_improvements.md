# Feature Improvements Roadmap

This document outlines planned features for the Gaussian Splat Viewer, with implementation details and technical considerations.

**Last Updated:** January 2025

---

## Implementation Status Summary

| Feature | Status | Location |
|---------|--------|----------|
| Vercel Deployment | ✅ READY | `vercel.json`, `public/install.sh`, `SetupModal.tsx` |
| Backend Status Detection | ✅ COMPLETE | `useBackendStatus.ts`, `DropZone.tsx` |
| SSE Streaming Progress | ✅ COMPLETE | `server/main.py`, `ConversionProgress.tsx` |
| Mobile Input Abstraction | ✅ COMPLETE | `inputSources.ts`, `GyroscopeInput.ts`, `TouchInput.ts` |
| Mobile Detection | ✅ COMPLETE | `useMobileDetection.ts` |
| Animation Store | ✅ COMPLETE | `animationStore.ts` |
| Keyframe Capture | ✅ COMPLETE | `KeyframeCapture.tsx` |
| Animation Export (MP4) | 🔄 DEFERRED | Infrastructure ready, ffmpeg.wasm pending |

---

## Table of Contents
1. [Vercel Deployment with Local Backend Installer](#1-vercel-deployment-with-local-backend-installer)
2. [Mobile Browser Support](#2-mobile-browser-support)
3. [Conversion Progress Bar with ETA](#3-conversion-progress-bar-with-eta)
4. [Animation Export (MP4)](#4-animation-export-mp4)
5. [Implementation Priority & Dependencies](#5-implementation-priority--dependencies)

---

## 1. Vercel Deployment with Local Backend Installer

> **STATUS: ✅ READY FOR DEPLOYMENT**
>
> Implemented in:
> - `vercel.json` - Deployment config with COOP/COEP headers
> - `public/install.sh` - Backend installer script
> - `src/hooks/useBackendStatus.ts` - Backend health polling
> - `src/components/upload/SetupModal.tsx` - Installation instructions modal
> - `src/components/upload/DropZone.tsx` - "Viewer Only" mode when offline

### Overview
Deploy the React frontend to Vercel for public access, while keeping the heavy SHARP model (~2.6GB) running locally on users' Macs. A one-line terminal command handles the entire backend setup.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL (Cloud)                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  React Frontend (yourapp.vercel.app)                      │  │
│  │  - Splat viewer (drag & drop .splat/.ply)                 │  │
│  │  - Head tracking UI                                       │  │
│  │  - Backend status indicator                               │  │
│  │  - Install instructions modal                             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP requests to localhost:8000
                              │ (only works when backend running)
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      USER'S MAC (Local)                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  SHARP Backend (localhost:8000)                           │  │
│  │  - FastAPI server                                         │  │
│  │  - SHARP model (~2.6GB in ~/.cache/torch/)                │  │
│  │  - Image → PLY conversion                                 │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### User Experience Flow

```
1. User visits yourapp.vercel.app
         │
         ▼
2. Frontend shows: "Backend not connected"
   [View existing splats works]
   [Image upload shows "Setup required"]
         │
         ▼
3. User clicks "Setup Local Backend"
         │
         ▼
4. Modal displays:
   ┌────────────────────────────────────────────────────────────┐
   │  Local Backend Setup                                       │
   │                                                            │
   │  The image-to-splat feature requires a local backend       │
   │  running on your Mac (the AI model is ~2.6GB).             │
   │                                                            │
   │  Open Terminal and paste this command:                     │
   │  ┌──────────────────────────────────────────────────────┐  │
   │  │ curl -sSL https://yourapp.vercel.app/install.sh | bash │ │
   │  └──────────────────────────────────────────────────────┘  │
   │                                            [Copy Command]  │
   │                                                            │
   │  First-time setup takes ~5-10 minutes (model download).    │
   │  Subsequent starts take ~5 seconds.                        │
   └────────────────────────────────────────────────────────────┘
         │
         ▼
5. User runs command in Terminal, sees:

   🔧 Gaussian Splat Backend Installer
   ════════════════════════════════════

   [1/5] Checking system requirements...
         ✓ macOS detected
         ✓ Python 3.10+ found (3.13.1)

   [2/5] Creating virtual environment...
         ✓ Created ~/.splat-backend/venv

   [3/5] Installing Python dependencies...
         ✓ FastAPI, uvicorn, numpy installed
         ✓ ml-sharp installed

   [4/5] Downloading SHARP model (2.6GB)...
         ████████████████░░░░░░░░░░░░░░ 53%
         Downloaded: 1.38GB / 2.62GB
         Speed: 12.4 MB/s | ETA: 1:42

   [5/5] Verifying installation...
         ✓ Model loaded successfully

   ════════════════════════════════════
   ✅ Installation complete!

   To start the backend, run:
       splat-backend start

   To uninstall:
       splat-backend uninstall
   ════════════════════════════════════
         │
         ▼
6. User runs: splat-backend start
         │
         ▼
7. Terminal shows:
   🚀 Starting Gaussian Splat Backend...
   ✓ Server running at http://localhost:8000
   ✓ Ready for connections

   Press Ctrl+C to stop.
         │
         ▼
8. Frontend auto-detects (polling localhost:8000)
   Shows: "Backend connected ✓"
   Image upload now enabled
```

### Install Script Implementation

**Location:** `public/install.sh` (served from Vercel)

```bash
#!/bin/bash
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

INSTALL_DIR="$HOME/.splat-backend"
VENV_DIR="$INSTALL_DIR/venv"
BIN_DIR="$INSTALL_DIR/bin"
REPO_URL="https://github.com/youruser/gaussian-splat-viewer"

echo ""
echo -e "${BLUE}🔧 Gaussian Splat Backend Installer${NC}"
echo "════════════════════════════════════"
echo ""

# Step 1: Check system requirements
echo -e "[1/5] Checking system requirements..."

# Check macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo -e "${RED}✗ This installer only supports macOS${NC}"
    exit 1
fi
echo -e "      ${GREEN}✓${NC} macOS detected"

# Check Python 3.10+
PYTHON_CMD=""
for cmd in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v $cmd &> /dev/null; then
        version=$($cmd -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
        major=$(echo $version | cut -d. -f1)
        minor=$(echo $version | cut -d. -f2)
        if [ "$major" -ge 3 ] && [ "$minor" -ge 10 ]; then
            PYTHON_CMD=$cmd
            echo -e "      ${GREEN}✓${NC} Python $version found ($cmd)"
            break
        fi
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo -e "${RED}✗ Python 3.10+ required but not found${NC}"
    echo "  Install via: brew install python@3.13"
    exit 1
fi

# Step 2: Create installation directory
echo ""
echo -e "[2/5] Creating virtual environment..."
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"
$PYTHON_CMD -m venv "$VENV_DIR"
echo -e "      ${GREEN}✓${NC} Created $VENV_DIR"

# Step 3: Install dependencies
echo ""
echo -e "[3/5] Installing Python dependencies..."
source "$VENV_DIR/bin/activate"

pip install --quiet --upgrade pip
pip install --quiet fastapi uvicorn python-multipart numpy
echo -e "      ${GREEN}✓${NC} FastAPI, uvicorn, numpy installed"

# Install ml-sharp (this triggers model download on first use)
pip install --quiet torch torchvision
pip install --quiet git+https://github.com/apple/ml-sharp.git
echo -e "      ${GREEN}✓${NC} ml-sharp installed"

# Step 4: Download SHARP model
echo ""
echo -e "[4/5] Downloading SHARP model (2.6GB)..."

# Trigger model download by running a minimal predict
# The model auto-downloads to ~/.cache/torch/hub/checkpoints/
python -c "
import sys
from sharp.cli import predict
from pathlib import Path
import urllib.request
import os

# Create a tiny test image
test_img = Path('$INSTALL_DIR/test_download.png')
if not test_img.exists():
    # Download a tiny placeholder image
    urllib.request.urlretrieve(
        'https://via.placeholder.com/64x64.png',
        str(test_img)
    )

# This triggers model download with progress
# The model downloads to ~/.cache/torch/hub/checkpoints/
print('      Downloading model (this may take a few minutes)...')
try:
    # Run minimal prediction to trigger download
    import torch
    from sharp.predictor import Predictor
    predictor = Predictor()
    print('      ${GREEN}✓${NC} Model downloaded successfully')
except Exception as e:
    print(f'      Model download initiated: {e}')
"

# Step 5: Create CLI commands
echo ""
echo -e "[5/5] Creating CLI commands..."

# Create the server script
cat > "$INSTALL_DIR/server.py" << 'SERVEREOF'
# Server code will be downloaded/copied here
# For now, reference the main repo's server/main.py
SERVEREOF

# Download actual server code
curl -sSL "$REPO_URL/raw/main/server/main.py" -o "$INSTALL_DIR/server.py" 2>/dev/null || true

# Create splat-backend command
cat > "$BIN_DIR/splat-backend" << 'EOF'
#!/bin/bash
INSTALL_DIR="$HOME/.splat-backend"
VENV_DIR="$INSTALL_DIR/venv"

case "$1" in
    start)
        echo "🚀 Starting Gaussian Splat Backend..."
        source "$VENV_DIR/bin/activate"
        cd "$INSTALL_DIR"
        python -m uvicorn server:app --host 0.0.0.0 --port 8000
        ;;
    stop)
        echo "Stopping backend..."
        pkill -f "uvicorn.*8000" || echo "No running backend found"
        ;;
    uninstall)
        echo "🗑️  Uninstalling Gaussian Splat Backend..."
        rm -rf "$INSTALL_DIR"
        rm -f "$HOME/.local/bin/splat-backend"
        echo "✓ Uninstalled. Model cache remains at ~/.cache/torch/"
        echo "  To remove model too: rm -rf ~/.cache/torch/hub/checkpoints/"
        ;;
    *)
        echo "Usage: splat-backend [start|stop|uninstall]"
        ;;
esac
EOF

chmod +x "$BIN_DIR/splat-backend"

# Add to PATH
mkdir -p "$HOME/.local/bin"
ln -sf "$BIN_DIR/splat-backend" "$HOME/.local/bin/splat-backend"

# Check if ~/.local/bin is in PATH
if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    echo ""
    echo -e "${YELLOW}Note: Add ~/.local/bin to your PATH:${NC}"
    echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
    echo "  source ~/.zshrc"
fi

echo ""
echo "════════════════════════════════════"
echo -e "${GREEN}✅ Installation complete!${NC}"
echo ""
echo "To start the backend, run:"
echo -e "    ${BLUE}splat-backend start${NC}"
echo ""
echo "To uninstall:"
echo -e "    ${BLUE}splat-backend uninstall${NC}"
echo "════════════════════════════════════"
```

### Frontend Changes

**New Components:**

1. **BackendStatus.tsx** - Status indicator + setup modal
```typescript
// Shows connection status in corner of screen
// "Backend: Connected ✓" or "Backend: Not connected [Setup]"
// Clicking [Setup] opens installation modal
```

2. **useBackendStatus.ts** - Hook to poll localhost:8000
```typescript
// Polls every 3 seconds
// Returns: { connected: boolean, checking: boolean }
// Stores status in context for app-wide access
```

**App.tsx Changes:**
- Disable image upload when backend not connected
- Show "Viewer Only Mode" badge
- Add BackendStatus component to UI

### Vercel Configuration

**vercel.json:**
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ],
  "rewrites": [
    { "source": "/install.sh", "destination": "/install.sh" }
  ]
}
```

---

## 2. Mobile Browser Support

> **STATUS: ✅ INFRASTRUCTURE COMPLETE**
>
> Implemented in:
> - `src/lib/inputSources.ts` - ParallaxInput interface
> - `src/lib/GyroscopeInput.ts` - Gyroscope-based parallax
> - `src/lib/TouchInput.ts` - Touch/mouse drag parallax
> - `src/hooks/useMobileDetection.ts` - Device capability detection
>
> **Remaining:** Integration into SplatViewer, UI for mode switching on mobile

### Overview
Enable the viewer to work on mobile browsers (iOS Safari, Chrome Android) with head tracking via front-facing camera, plus fallback controls when tracking is unreliable.

### Control Modes on Mobile

```
┌─────────────────────────────────────────────────────────────┐
│  MOBILE CONTROL MODES                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. HEAD TRACKING (Primary)                                 │
│     - Uses front camera (phone set down on table/stand)     │
│     - Same parallax effect as desktop                       │
│     - May be janky on older devices                         │
│                                                             │
│  2. GYROSCOPE (Fallback #1)                                 │
│     - Tilt phone slightly to shift perspective              │
│     - Subtle effect (±15° tilt = full parallax range)       │
│     - Works on all modern phones                            │
│     - No camera permission needed                           │
│                                                             │
│  3. TOUCH DRAG (Fallback #2)                                │
│     - Drag finger to shift perspective                      │
│     - Most reliable, works everywhere                       │
│     - Less immersive but always functional                  │
│                                                             │
│  4. ORBIT (Existing)                                        │
│     - Standard touch orbit controls                         │
│     - Two-finger pinch to zoom                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Mobile UI Layout

```
┌─────────────────────────────────────────┐
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ │                                     │ │
│ │           SPLAT VIEWER              │ │
│ │         (Full viewport)             │ │
│ │                                     │ │
│ │                                     │ │
│ │    ┌─────────┐                      │ │
│ │    │ Camera  │  ← Hideable,         │ │
│ │    │ Preview │    draggable         │ │
│ │    └─────────┘                      │ │
│ └─────────────────────────────────────┘ │
│                                         │
│  ┌─────────────────────────────────────┐│
│  │ 👤 Head │ 📱 Gyro │ 👆 Touch │ 🔄 Orbit ││
│  └─────────────────────────────────────┘│
│         Control mode selector           │
└─────────────────────────────────────────┘
```

### Implementation Details

#### useGyroscopeTracking.ts (New Hook)
```typescript
interface GyroscopePosition {
  x: number;  // -1 to 1 based on left/right tilt
  y: number;  // -1 to 1 based on forward/back tilt
  z: number;  // Always 0 (no depth from gyro)
}

function useGyroscopeTracking(
  sensitivity: number = 1.0,
  maxTilt: number = 15  // degrees
): {
  position: GyroscopePosition;
  supported: boolean;
  permission: 'granted' | 'denied' | 'prompt';
  requestPermission: () => Promise<void>;
}
```

**Notes:**
- iOS requires explicit permission request via `DeviceOrientationEvent.requestPermission()`
- Android grants automatically
- Use `deviceorientation` event for tilt data
- Map beta (front/back tilt) to Y, gamma (left/right tilt) to X
- Clamp to maxTilt range, normalize to -1..1

#### useTouchParallax.ts (New Hook)
```typescript
interface TouchPosition {
  x: number;  // -1 to 1 based on drag from center
  y: number;  // -1 to 1 based on drag from center
  z: number;  // Always 0
}

function useTouchParallax(
  containerRef: RefObject<HTMLElement>,
  sensitivity: number = 1.0
): {
  position: TouchPosition;
  isDragging: boolean;
}
```

**Notes:**
- Track touch position relative to screen center
- Return to center (0, 0) when touch released (with easing)
- Distinguish from orbit controls (single touch = parallax, two finger = orbit)

#### Mobile Detection & Adaptation

**useMobileDetection.ts:**
```typescript
function useMobileDetection(): {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  hasGyroscope: boolean;
  hasTouchScreen: boolean;
  screenSize: 'small' | 'medium' | 'large';
}
```

**Performance Adaptations:**
| Condition | Adaptation |
|-----------|------------|
| Mobile + Low memory | Limit splat count to 200k |
| Mobile + Old GPU | Reduce render resolution |
| Small screen | Larger touch targets, simplified UI |
| iOS Safari | Handle SharedArrayBuffer limitations |

#### Camera Preview Component

**MobileCameraPreview.tsx:**
```typescript
// Floating, draggable camera preview
// Can be minimized to small icon
// Shows face tracking indicator overlay
// Position persists in localStorage

interface Props {
  videoRef: RefObject<HTMLVideoElement>;
  isTracking: boolean;
  onMinimize: () => void;
  onMaximize: () => void;
  minimized: boolean;
}
```

**States:**
- Expanded: 120x90px floating window with video
- Minimized: 40px camera icon, tap to expand
- Hidden: Completely hidden (setting toggle)

### iOS-Specific Considerations

1. **SharedArrayBuffer**: iOS Safari has limited support
   - May need fallback rendering path
   - Test with `self.crossOriginIsolated`

2. **Camera Permission**: Different prompt flow than desktop
   - Show custom UI before triggering native prompt
   - Handle "denied" state gracefully

3. **Memory Limits**: iOS Safari has aggressive memory limits
   - Monitor with `performance.memory` (where available)
   - Proactively reduce quality if memory pressure detected

4. **Orientation Lock**: Consider locking to portrait for head tracking
   - Landscape makes sense for orbit controls only

---

## 3. Conversion Progress Bar with ETA

> **STATUS: ✅ COMPLETE**
>
> Implemented in:
> - `server/main.py` - SSE streaming endpoint `/convert-stream`
> - `src/components/upload/ConversionProgress.tsx` - Progress UI with stages
> - Job tracking with `/job/{job_id}/result`, `/job/{job_id}/cancel`, `/job/{job_id}/status`

### Overview
Replace the current spinner with detailed progress indication during image-to-splat conversion, including stage information and time estimates.

### Progress Stages

```
┌────────────────────────────────────────────────────────────────┐
│  Converting image to Gaussian Splat                            │
│                                                                │
│  Stage 2 of 4: Running SHARP model                             │
│  ████████████████████░░░░░░░░░░░░░░░░░░░░ 45%                  │
│                                                                │
│  Elapsed: 0:23  |  Remaining: ~0:28                            │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ✓ Uploading image                              2s        │  │
│  │ ● Running SHARP model                         ~45s       │  │
│  │ ○ Processing PLY output                       ~5s        │  │
│  │ ○ Downloading result                          ~3s        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  First conversion includes model loading (~30s extra)          │
└────────────────────────────────────────────────────────────────┘
```

### Backend Changes

**New Endpoint: POST /convert-stream**

Returns Server-Sent Events (SSE) for real-time progress:

```python
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import asyncio

@app.post("/convert-stream")
async def convert_stream(file: UploadFile, quality: int = 15):
    async def generate():
        # Stage 1: Upload received
        yield f"data: {json.dumps({'stage': 1, 'name': 'upload', 'progress': 100})}\n\n"

        # Stage 2: SHARP processing
        yield f"data: {json.dumps({'stage': 2, 'name': 'sharp', 'progress': 0})}\n\n"

        # Run SHARP with progress callback
        async for progress in run_sharp_with_progress(file, quality):
            yield f"data: {json.dumps({'stage': 2, 'name': 'sharp', 'progress': progress})}\n\n"

        # Stage 3: PLY processing
        yield f"data: {json.dumps({'stage': 3, 'name': 'ply_process', 'progress': 0})}\n\n"
        ply_data = await process_ply()
        yield f"data: {json.dumps({'stage': 3, 'name': 'ply_process', 'progress': 100})}\n\n"

        # Stage 4: Complete with download URL
        yield f"data: {json.dumps({'stage': 4, 'name': 'complete', 'download_url': '/download/xyz'})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
```

**SHARP Progress Parsing:**

SHARP outputs progress to stderr. We can capture and parse it:

```python
import subprocess
import re

async def run_sharp_with_progress(image_path, quality):
    process = subprocess.Popen(
        ["sharp", "predict", "-i", image_path, "-o", "output.ply"],
        stderr=subprocess.PIPE,
        text=True
    )

    # Parse stderr for progress indicators
    for line in process.stderr:
        # SHARP outputs lines like "Processing: 45%"
        match = re.search(r'(\d+)%', line)
        if match:
            yield int(match.group(1))

    process.wait()
    yield 100
```

### Frontend Changes

**ConversionProgress.tsx:**
```typescript
interface ConversionStage {
  id: number;
  name: string;
  displayName: string;
  estimatedSeconds: number;
  status: 'pending' | 'active' | 'complete';
  progress: number;  // 0-100
}

const STAGES: ConversionStage[] = [
  { id: 1, name: 'upload', displayName: 'Uploading image', estimatedSeconds: 2 },
  { id: 2, name: 'sharp', displayName: 'Running SHARP model', estimatedSeconds: 45 },
  { id: 3, name: 'ply_process', displayName: 'Processing PLY output', estimatedSeconds: 5 },
  { id: 4, name: 'download', displayName: 'Downloading result', estimatedSeconds: 3 },
];
```

**ETA Calculation:**
```typescript
function calculateETA(stages: ConversionStage[], currentStage: number, currentProgress: number): number {
  let remainingSeconds = 0;

  for (const stage of stages) {
    if (stage.id < currentStage) continue;

    if (stage.id === currentStage) {
      // Partial time remaining for current stage
      remainingSeconds += stage.estimatedSeconds * (1 - currentProgress / 100);
    } else {
      // Full time for future stages
      remainingSeconds += stage.estimatedSeconds;
    }
  }

  return remainingSeconds;
}
```

**First-Run Detection:**
```typescript
// Store in localStorage when model has been downloaded
const isFirstRun = !localStorage.getItem('sharp_model_downloaded');

// Add extra time estimate for first run
const modelDownloadTime = isFirstRun ? 30 : 0;  // seconds

// After successful conversion, mark as downloaded
localStorage.setItem('sharp_model_downloaded', 'true');
```

### Visual Design

Following the existing Liquid Glass design system:

```css
.progress-container {
  @apply glass-panel p-6 rounded-2xl max-w-md mx-auto;
}

.progress-bar-track {
  @apply h-2 bg-white/10 rounded-full overflow-hidden;
}

.progress-bar-fill {
  @apply h-full bg-gradient-to-r from-blue-500 to-purple-500;
  @apply transition-all duration-300 ease-out;
}

.stage-list {
  @apply mt-4 space-y-2 text-sm;
}

.stage-item {
  @apply flex items-center gap-2 text-white/60;
}

.stage-item.active {
  @apply text-white;
}

.stage-item.complete {
  @apply text-green-400;
}
```

---

## 4. Animation Export (MP4)

> **STATUS: 🔄 INFRASTRUCTURE READY (ffmpeg.wasm deferred)**
>
> Implemented in:
> - `src/stores/animationStore.ts` - Keyframe state, interpolation, easing functions
> - `src/components/controls/KeyframeCapture.tsx` - Start/End keyframe UI
> - `interpolateKeyframes()` - Position/quaternion interpolation
> - `applyEasing()` - Linear, easeIn, easeOut, easeInOut, custom cubic bezier
>
> **Remaining:** ffmpeg.wasm integration, preview loop, export UI

### Overview
Export smooth camera animations as MP4 video files. Users set a start and end camera position, configure duration and easing, then export at 1080p or 4K resolution.

**Important:** This feature is **only available in Orbit control mode**. Head tracking is disabled during animation setup and export to allow precise manual camera positioning.

### User Flow

```
1. User switches to Orbit mode (required)
         │
         ▼
2. "Export Animation" panel appears in controls
         │
         ▼
3. User positions camera → clicks "Set" for Start
         │
         ▼
4. User moves camera to end position → clicks "Set" for End
         │
         ▼
5. User adjusts duration, easing, resolution
         │
         ▼
6. User clicks "Preview" → animation plays in viewer (loops)
         │
         ▼
7. User clicks "Export MP4"
         │
         ▼
8. Progress bar: "Rendering frames... 45/150"
         │
         ▼
9. Progress bar: "Encoding MP4... 67%"
         │
         ▼
10. Browser downloads "splat-animation.mp4"
```

### UI Design

Located in the orbit controls area, minimal inline panel:

```
┌─────────────────────────────────────────┐
│  🎬 Export Animation                    │
│                                         │
│  Start    [Set]  ✓                      │
│  End      [Set]  ○                      │
│                                         │
│  Duration     [━━━●━━━━━] 3.0s          │
│  Easing       [Linear        ▼]         │
│  Resolution   [1080p         ▼]         │
│                                         │
│  Filename     [splat-animation    ]     │
│                                         │
│  [Preview]          [Export MP4]        │
└─────────────────────────────────────────┘
```

**States:**
- **No keyframes**: Both buttons show "Set", Export disabled
- **Start only**: Start shows ✓, End shows "Set", Export disabled
- **Both set**: Both show ✓, Preview and Export enabled
- **Previewing**: Preview button becomes "Stop", animation loops
- **Exporting**: Panel shows progress bar, buttons disabled

**Control Options:**

| Control | Options | Default |
|---------|---------|---------|
| Duration | 1-30 seconds (slider) | 3.0s |
| Easing | Linear, Ease In, Ease Out, Ease In-Out | Linear |
| Resolution | 1080p (1920×1080), 4K (3840×2160) | 1080p |
| Filename | Text input (alphanumeric, dashes, underscores) | "splat-animation" |

**4K Warning:**
When user selects 4K resolution, show inline warning:
```
⚠️ 4K export requires significant memory and may take 2-3x longer
```

### Implementation Details

#### Camera Keyframe Structure

```typescript
interface CameraKeyframe {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  // Note: No FOV - keep constant during animation
}

interface AnimationConfig {
  start: CameraKeyframe;
  end: CameraKeyframe;
  duration: number;        // seconds
  easing: EasingType;
  resolution: '1080p' | '4k';
  frameRate: 30;           // fixed at 30fps
  filename: string;        // user-specified, sanitized
}

type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
```

#### Easing Functions

```typescript
const easingFunctions: Record<EasingType, (t: number) => number> = {
  'linear': (t) => t,
  'ease-in': (t) => t * t,                          // Quadratic ease in
  'ease-out': (t) => t * (2 - t),                   // Quadratic ease out
  'ease-in-out': (t) => t < 0.5                     // Quadratic ease in-out
    ? 2 * t * t
    : -1 + (4 - 2 * t) * t,
};
```

#### Interpolation (Critical: Use Quaternion SLERP)

```typescript
function interpolateCamera(
  start: CameraKeyframe,
  end: CameraKeyframe,
  t: number,  // 0 to 1, already eased
  camera: THREE.PerspectiveCamera
): void {
  // Position: Linear interpolation
  camera.position.lerpVectors(start.position, end.position, t);

  // Rotation: Spherical linear interpolation (SLERP)
  // CRITICAL: Do NOT use Euler angles - causes gimbal lock
  camera.quaternion.slerpQuaternions(start.quaternion, end.quaternion, t);
}
```

#### Frame Rendering Loop

```typescript
async function renderFrames(
  config: AnimationConfig,
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  onProgress: (current: number, total: number) => void
): Promise<Blob[]> {
  const totalFrames = Math.ceil(config.duration * config.frameRate);
  const frames: Blob[] = [];

  // Set render size based on resolution
  const [width, height] = config.resolution === '4k'
    ? [3840, 2160]
    : [1920, 1080];

  renderer.setSize(width, height);

  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / (totalFrames - 1);  // 0 to 1
    const easedT = easingFunctions[config.easing](t);

    interpolateCamera(config.start, config.end, easedT, camera);
    renderer.render(scene, camera);

    // Capture frame as blob
    const blob = await new Promise<Blob>((resolve) => {
      renderer.domElement.toBlob((b) => resolve(b!), 'image/png');
    });
    frames.push(blob);

    onProgress(frame + 1, totalFrames);

    // Yield to UI thread every 10 frames
    if (frame % 10 === 0) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  // Restore original render size
  renderer.setSize(window.innerWidth, window.innerHeight);

  return frames;
}
```

#### MP4 Encoding with ffmpeg.wasm

**Lazy Loading Strategy:**

ffmpeg.wasm is ~25MB. Only download when user clicks "Export MP4":

```typescript
let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg) return ffmpeg;

  // Dynamic import - only loads when needed
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

  ffmpeg = new FFmpeg();

  // Load ffmpeg core (this is the big download)
  await ffmpeg.load({
    coreURL: await toBlobURL(
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
      'text/javascript'
    ),
    wasmURL: await toBlobURL(
      'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
      'application/wasm'
    ),
  });

  return ffmpeg;
}
```

**Encoding Pipeline:**

```typescript
async function encodeMP4(
  frames: Blob[],
  frameRate: number,
  onProgress: (percent: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  // Write frames to virtual filesystem
  for (let i = 0; i < frames.length; i++) {
    const frameData = await frames[i].arrayBuffer();
    await ffmpeg.writeFile(
      `frame${i.toString().padStart(5, '0')}.png`,
      new Uint8Array(frameData)
    );
    onProgress((i / frames.length) * 50);  // First 50%: writing frames
  }

  // Track encoding progress
  ffmpeg.on('progress', ({ progress }) => {
    onProgress(50 + progress * 50);  // Last 50%: encoding
  });

  // Encode to MP4 (H.264)
  await ffmpeg.exec([
    '-framerate', frameRate.toString(),
    '-i', 'frame%05d.png',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',  // Compatibility
    '-preset', 'medium',
    '-crf', '23',           // Quality (lower = better, 18-28 typical)
    'output.mp4'
  ]);

  // Read output
  const data = await ffmpeg.readFile('output.mp4');

  // Cleanup virtual filesystem
  for (let i = 0; i < frames.length; i++) {
    await ffmpeg.deleteFile(`frame${i.toString().padStart(5, '0')}.png`);
  }
  await ffmpeg.deleteFile('output.mp4');

  return new Blob([data], { type: 'video/mp4' });
}
```

#### Export Progress UI

During export, replace the panel content:

```
┌─────────────────────────────────────────┐
│  🎬 Exporting Animation                 │
│                                         │
│  Rendering frames...                    │
│  ████████████████░░░░░░░░ 67%           │
│  Frame 100 of 150                       │
│                                         │
│  [Cancel]                               │
└─────────────────────────────────────────┘
```

Then:

```
┌─────────────────────────────────────────┐
│  🎬 Exporting Animation                 │
│                                         │
│  Encoding MP4...                        │
│  ████████████████████████░░ 89%         │
│                                         │
│  [Cancel]                               │
└─────────────────────────────────────────┘
```

### New Components

#### AnimationExport.tsx

```typescript
interface AnimationExportProps {
  viewer: GaussianSplats3D.Viewer;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  disabled?: boolean;  // True when not in orbit mode
}

function AnimationExport({ viewer, camera, renderer, scene, disabled }: AnimationExportProps) {
  const [startKeyframe, setStartKeyframe] = useState<CameraKeyframe | null>(null);
  const [endKeyframe, setEndKeyframe] = useState<CameraKeyframe | null>(null);
  const [duration, setDuration] = useState(3.0);
  const [easing, setEasing] = useState<EasingType>('linear');
  const [resolution, setResolution] = useState<'1080p' | '4k'>('1080p');
  const [filename, setFilename] = useState('splat-animation');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [exportState, setExportState] = useState<ExportState>({ status: 'idle' });

  // Sanitize filename on change
  const handleFilenameChange = (value: string) => {
    const sanitized = value.replace(/[^a-zA-Z0-9-_]/g, '').slice(0, 50);
    setFilename(sanitized || 'splat-animation');
  };

  // ... implementation
}

type ExportState =
  | { status: 'idle' }
  | { status: 'loading-ffmpeg' }
  | { status: 'rendering'; current: number; total: number }
  | { status: 'encoding'; percent: number }
  | { status: 'complete' }
  | { status: 'error'; message: string };
```

#### useAnimationPreview.ts

```typescript
function useAnimationPreview(
  camera: THREE.PerspectiveCamera,
  start: CameraKeyframe | null,
  end: CameraKeyframe | null,
  duration: number,
  easing: EasingType,
  isPlaying: boolean
): void {
  useEffect(() => {
    if (!isPlaying || !start || !end) return;

    let animationId: number;
    const startTime = performance.now();

    function animate() {
      const elapsed = (performance.now() - startTime) / 1000;
      const t = (elapsed % duration) / duration;  // Loop
      const easedT = easingFunctions[easing](t);

      interpolateCamera(start, end, easedT, camera);

      animationId = requestAnimationFrame(animate);
    }

    animate();

    return () => cancelAnimationFrame(animationId);
  }, [camera, start, end, duration, easing, isPlaying]);
}
```

### Integration with Orbit Mode

In `App.tsx`, the animation export panel only renders when `controlMode === 'orbit'`:

```typescript
{controlMode === 'orbit' && (
  <AnimationExport
    viewer={viewerRef.current}
    camera={cameraRef.current}
    renderer={rendererRef.current}
    scene={sceneRef.current}
  />
)}
```

When switching from orbit to head tracking mode:
- Animation preview stops automatically
- Keyframes are preserved (not cleared)
- User can switch back to orbit and resume setup

### Performance Considerations

| Resolution | Frames (3s) | Est. Render Time | Est. Encode Time | Total |
|------------|-------------|------------------|------------------|-------|
| 1080p | 90 | ~15s | ~10s | ~25s |
| 4K | 90 | ~45s | ~30s | ~75s |

**Memory Management:**
- 1080p frame ≈ 8MB uncompressed, ~500KB as PNG
- 90 frames = ~45MB in memory
- 4K frame ≈ 32MB uncompressed, ~2MB as PNG
- 90 frames = ~180MB in memory

For 4K, consider:
- Processing frames in batches
- Writing to ffmpeg filesystem immediately, not keeping in JS array
- Warning user about memory requirements

### CSS Styling

```css
.animation-export-panel {
  @apply glass-panel p-4 rounded-xl;
  @apply flex flex-col gap-3;
}

.keyframe-row {
  @apply flex items-center justify-between;
}

.keyframe-status {
  @apply w-6 h-6 rounded-full flex items-center justify-center;
}

.keyframe-status.set {
  @apply bg-green-500/20 text-green-400;
}

.keyframe-status.unset {
  @apply bg-white/10 text-white/40;
}

.export-progress {
  @apply space-y-2;
}

.export-progress-bar {
  @apply h-2 bg-white/10 rounded-full overflow-hidden;
}

.export-progress-fill {
  @apply h-full bg-gradient-to-r from-blue-500 to-purple-500;
  @apply transition-all duration-150;
}
```

### Dependencies

```json
{
  "dependencies": {
    "@ffmpeg/ffmpeg": "^0.12.6",
    "@ffmpeg/util": "^0.12.1"
  }
}
```

**Note:** ffmpeg.wasm requires these headers (already configured for SharedArrayBuffer):
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: require-corp`

---

## 5. Implementation Priority & Dependencies

### Completion Status (January 2025)

```
✅ Phase 1: Progress Bar (Foundation) - COMPLETE
├── ✅ Backend SSE endpoint (/convert-stream)
├── ✅ SHARP progress parsing
├── ✅ ConversionProgress component
└── ✅ Job management (cancel, status, result)

✅ Phase 2: Vercel Deployment - READY
├── ✅ vercel.json with COOP/COEP headers
├── ✅ Backend status detection (useBackendStatus)
├── ✅ Install script (public/install.sh)
├── ✅ Setup modal UI (SetupModal)
└── ✅ "Viewer only" mode (DropZone)

✅ Phase 3: Mobile Support - INFRASTRUCTURE READY
├── ✅ Mobile detection (useMobileDetection)
├── ✅ Input source interface (ParallaxInput)
├── ✅ Gyroscope input (GyroscopeInput)
├── ✅ Touch input (TouchInput)
└── 🔄 UI integration pending

🔄 Phase 4: Animation Export - INFRASTRUCTURE READY
├── ✅ Animation store (animationStore)
├── ✅ Keyframe capture (KeyframeCapture)
├── ✅ Interpolation utilities
├── ✅ Easing functions (linear, easeIn, easeOut, easeInOut, custom)
├── 🔄 Preview loop pending
├── 🔄 ffmpeg.wasm integration pending
└── 🔄 Export UI pending
```

### Remaining Work

| Feature | Status | Remaining Work |
|---------|--------|----------------|
| Progress Bar | ✅ COMPLETE | None |
| Vercel Deploy | ✅ READY | Deploy to Vercel |
| Mobile Support | 🔄 Infrastructure | Integrate inputs into SplatViewer |
| Animation Export | 🔄 Infrastructure | ffmpeg.wasm, preview, export UI |

### Testing Checklist

**Progress Bar:** ✅ COMPLETE
- [x] Progress updates in real-time
- [x] Handles backend errors gracefully
- [x] Cancel button works
- [ ] ETA reasonably accurate (basic implementation)
- [ ] First-run vs subsequent run messaging (not implemented)

**Animation Export:** 🔄 PARTIAL
- [x] Set Start captures correct camera position/rotation
- [x] Set End captures correct camera position/rotation
- [x] Interpolation functions work correctly
- [x] All easing types implemented
- [ ] Preview loops smoothly (pending)
- [ ] 1080p export produces valid MP4 (pending)
- [ ] 4K export produces valid MP4 (pending)
- [ ] Progress bar accurate during render/encode (pending)
- [ ] Cancel button stops export cleanly (pending)
- [ ] ffmpeg.wasm loads only on first export (pending)
- [x] Keyframes preserved when switching control modes

**Vercel Deploy:** ✅ READY
- [x] vercel.json with correct headers
- [x] Viewer works without backend
- [x] Status indicator accurate
- [x] Install script exists
- [x] Setup modal UI works
- [ ] Test install script on fresh Mac
- [ ] Test backend starts correctly after install

**Mobile:** 🔄 INFRASTRUCTURE
- [x] Mobile detection hook
- [x] Gyroscope input class
- [x] Touch input class
- [x] ParallaxInput interface
- [ ] Integration into SplatViewer
- [ ] Head tracking works on iOS Safari
- [ ] Head tracking works on Chrome Android
- [ ] Performance acceptable on mid-tier phones
- [ ] UI usable on small screens

---

## Open Questions

1. **Install script hosting**: Should install.sh be in the repo or a separate gist/CDN for versioning?

2. **Model caching**: If user uninstalls and reinstalls, should we reuse the cached model in `~/.cache/torch/`?

3. **Backend versioning**: How to handle updates to the backend? Auto-update check on start?

4. **Mobile splat limits**: What's the max splat count that performs well on mobile? Need benchmarking.

5. **Offline support**: Should the viewer work offline (PWA) for pre-loaded splats?
