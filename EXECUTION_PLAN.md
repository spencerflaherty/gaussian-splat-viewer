# Autonomous Execution Plan
## Splat Window Refactor - Ralph Wiggum Mode

This document is designed for autonomous Claude execution. Each task has clear inputs, outputs, and validation steps.

---

## How to Use This Document

Tell Claude:
```
Work through EXECUTION_PLAN.md systematically. Complete each task, validate it works, then move to the next. Update the checkboxes as you go. If something breaks, fix it before continuing. Run for as long as needed.
```

---

## Phase 0: Library Migration (CRITICAL - DO FIRST)

### Task 0.1: Install Spark
- [ ] Run `npm install @aspect-dev/spark` (or correct package name after verification)
- [ ] Verify installation in package.json
- [ ] Check Spark documentation for Three.js integration pattern

**Validation:** `npm ls @aspect-dev/spark` shows installed version

### Task 0.2: Create Spark Adapter
- [ ] Create `src/lib/splatRenderer.ts`
- [ ] Implement wrapper that matches current GaussianSplats3D API pattern
- [ ] Export: `createViewer`, `loadScene`, `disposeViewer`

**Validation:** File exists with TypeScript compiling

### Task 0.3: Update SplatWindow to Use Adapter
- [ ] Replace direct GaussianSplats3D import with adapter
- [ ] Keep all existing camera/projection logic
- [ ] Test with sample .splat file

**Validation:** Can load and view `public/samples/sample_train.splat` (or any test file)

### Task 0.4: Test PLY Rotation Fix
- [ ] Verify SHARP PLY files still render correctly
- [ ] Adjust rotation quaternion if needed for Spark
- [ ] Test with backend conversion

**Validation:** Image → PLY conversion displays right-side-up

### Task 0.5: Remove Old Library
- [ ] `npm uninstall @mkkellogg/gaussian-splats-3d`
- [ ] Remove any remaining direct imports
- [ ] Clean up unused type definitions

**Validation:** `npm ls` shows no gaussian-splats-3d, app still works

---

## Phase 1: Component Extraction

### Task 1.1: Create Directory Structure
- [ ] Create `src/components/ui/`
- [ ] Create `src/components/viewer/`
- [ ] Create `src/components/controls/`
- [ ] Create `src/components/upload/`
- [ ] Create `src/stores/`
- [ ] Create `src/lib/`

**Validation:** Directories exist

### Task 1.2: Extract LiquidGlass Component
- [ ] Create `src/components/ui/LiquidGlass.tsx`
- [ ] Move LiquidGlass function from App.tsx
- [ ] Convert inline styles to CSS classes in index.css
- [ ] Export component
- [ ] Update App.tsx to import from new location

**Validation:** App renders identically, no inline styles in LiquidGlass

### Task 1.3: Extract Toggle Component
- [ ] Create `src/components/ui/Toggle.tsx`
- [ ] Move Toggle function from App.tsx
- [ ] Convert inline styles to Tailwind/CSS
- [ ] Export component
- [ ] Update App.tsx imports

**Validation:** Toggle switches work, styling matches

### Task 1.4: Extract Slider Component
- [ ] Create `src/components/ui/Slider.tsx`
- [ ] Extract renderSlider logic from App.tsx
- [ ] Make it a proper React component with props
- [ ] Handle both slider and number input
- [ ] Show ACTUAL values, not offsets

**Validation:** Sliders show real values (e.g., "2.5" not "0")

### Task 1.5: Extract HUDOverlay Component
- [ ] Create `src/components/controls/HUD.tsx`
- [ ] Move entire HUDOverlay function (~250 lines)
- [ ] Keep all existing functionality
- [ ] Convert inline styles to CSS

**Validation:** HUD appears, mode switching works, settings panel works

### Task 1.6: Extract ModeSwitcher Component
- [ ] Create `src/components/controls/ModeSwitcher.tsx`
- [ ] Extract the Head Track / Orbit pill from HUD
- [ ] Make it a standalone component

**Validation:** Mode switching still works

### Task 1.7: Extract SettingsPanel Component
- [ ] Create `src/components/controls/SettingsPanel.tsx`
- [ ] Extract settings panel from HUD
- [ ] Include all slider sections

**Validation:** All sliders work, values persist

### Task 1.8: Extract DropZone Component
- [ ] Create `src/components/upload/DropZone.tsx`
- [ ] Extract drag-and-drop and file input logic
- [ ] Handle all file types (.splat, .ply, images)

**Validation:** Can drop files, click to upload

### Task 1.9: Extract Loading/Error Overlays
- [ ] Create `src/components/viewer/LoadingOverlay.tsx`
- [ ] Create `src/components/viewer/ErrorOverlay.tsx`
- [ ] Move from SplatWindow.tsx

**Validation:** Loading spinner shows, errors display

### Task 1.10: Rename SplatWindow to SplatViewer
- [ ] Rename `src/components/SplatWindow.tsx` to `src/components/viewer/SplatViewer.tsx`
- [ ] Update all imports
- [ ] Keep all projection/camera logic intact

**Validation:** Viewer still works with head tracking

---

## Phase 2: State Management

### Task 2.1: Install Zustand
- [ ] Run `npm install zustand`
- [ ] Verify installation

**Validation:** `npm ls zustand` shows version

### Task 2.2: Create Settings Store
- [ ] Create `src/stores/settingsStore.ts`
- [ ] Define Settings interface (from HeadTrackingParams)
- [ ] Implement persist middleware for localStorage
- [ ] Add preset definitions: subtle, natural, dramatic
- [ ] Add actions: updateSetting, applyPreset, reset

**Validation:** Store can be imported, presets defined

### Task 2.3: Create Viewer Store
- [ ] Create `src/stores/viewerStore.ts`
- [ ] Define state: splatUrl, format, isLoading, error, controlMode
- [ ] Add actions: loadSplat, setControlMode, setError, reset

**Validation:** Store can be imported

### Task 2.4: Migrate App.tsx State to Stores
- [ ] Replace useState calls with useStore hooks
- [ ] Remove redundant state
- [ ] Verify all functionality still works

**Validation:** App works with Zustand, fewer useState calls

### Task 2.5: Implement Auto-Save for Settings
- [ ] Settings store persists to localStorage automatically
- [ ] Remove manual "Save" button
- [ ] Add "Reset to Defaults" functionality

**Validation:** Change a setting, refresh page, setting persists

---

## Phase 3: Settings UX Overhaul

### Task 3.1: Create Presets UI
- [ ] Add preset buttons to SettingsPanel: Subtle, Natural, Dramatic
- [ ] Define preset values in settingsStore
- [ ] One-click applies all settings

**Validation:** Clicking preset changes all values

### Task 3.2: Fix Slider Value Display
- [ ] Sliders show ACTUAL values, not offsets
- [ ] Remove toSliderValue/fromSliderValue functions
- [ ] Update Slider component to use actual min/max

**Validation:** "Distance" slider shows "2.5" when at default

### Task 3.3: Add Semantic Labels to Sliders
- [ ] Add "Subtle" / "Dramatic" labels at slider ends where appropriate
- [ ] Keep numeric input for precise control

**Validation:** Sliders have helpful context labels

### Task 3.4: Create Calibration Wizard
- [ ] Create `src/components/controls/CalibrationWizard.tsx`
- [ ] Show progress during 30-frame calibration
- [ ] "Hold still" instruction
- [ ] Recalibrate button

**Validation:** User sees calibration progress, can recalibrate

### Task 3.5: Improve Settings Discoverability
- [ ] Settings panel visible by default on first use
- [ ] Add subtle animation to draw attention
- [ ] Store "has seen settings" in localStorage

**Validation:** New users see settings, returning users don't

---

## Phase 4: Performance Fixes

### Task 4.1: Add Lazy Loading for MediaPipe
- [ ] Wrap useHeadTracking in lazy-loaded component
- [ ] Only load when head tracking mode selected
- [ ] Show loading state during WASM download

**Validation:** Initial bundle smaller, MediaPipe loads on demand

### Task 4.2: Remove Debug Logging in Production
- [ ] Find all console.log statements
- [ ] Wrap in `if (import.meta.env.DEV)` or remove
- [ ] Remove the 500ms debug interval entirely

**Validation:** Production build has no console spam

### Task 4.3: Fix Stale Closure in Camera Update
- [ ] Use useRef for headTrackingParams in SplatViewer
- [ ] Or move param extraction inside RAF callback
- [ ] Verify slider changes take immediate effect

**Validation:** Moving a slider immediately affects the view

### Task 4.4: Optimize RAF Loop
- [ ] Only run head tracking RAF when controlMode === 'head'
- [ ] Clean up RAF on mode switch
- [ ] Verify no memory leaks

**Validation:** CPU usage drops in orbit mode

### Task 4.5: Add Adaptive Quality (Optional)
- [ ] Monitor frame rate
- [ ] Reduce quality if below 30fps
- [ ] Add quality preset option

**Validation:** Smooth experience on weaker hardware

---

## Phase 5: Backend Improvements

### Task 5.1: Add Temp File Cleanup
- [ ] Add cleanup after FileResponse sent
- [ ] Or add background task to delete files older than 1 hour
- [ ] Test that temp directories don't grow

**Validation:** temp_uploads and temp_outputs stay clean

### Task 5.2: Implement SSE Streaming Endpoint
- [ ] Create `/convert-stream` endpoint
- [ ] Use asyncio subprocess
- [ ] Parse SHARP stderr for progress
- [ ] Yield SSE events

**Validation:** Can curl endpoint and see progress events

### Task 5.3: Create ConversionProgress Component
- [ ] Create `src/components/upload/ConversionProgress.tsx`
- [ ] Connect to SSE endpoint
- [ ] Show stage, progress bar, ETA

**Validation:** Progress updates in real-time during conversion

### Task 5.4: Add Cancel Support
- [ ] Frontend can abort conversion
- [ ] Backend kills subprocess on disconnect
- [ ] Clean up partial files

**Validation:** Cancel button stops conversion

---

## Phase 6: CSS Consolidation

### Task 6.1: Audit Inline Styles
- [ ] List all inline style={{}} in codebase
- [ ] Categorize by component

**Output:** List of files needing style migration

### Task 6.2: Consolidate Design System
- [ ] Decide: iOS 26 Light Glass (current TS) or Dark Glass (current CSS)
- [ ] Update index.css with chosen direction
- [ ] Create utility classes for common patterns

**Validation:** Single consistent design language

### Task 6.3: Replace Inline Styles
- [ ] Convert each inline style to CSS class
- [ ] Use Tailwind where appropriate
- [ ] Remove all style={{}} from components

**Validation:** No inline styles remain, app looks identical

---

## Phase 7: Input Source Abstraction (For Mobile)

### Task 7.1: Define Input Source Interface
- [ ] Create `src/lib/inputSources.ts`
- [ ] Define ParallaxInput interface
- [ ] position: {x, y, z}, isActive, calibrate(), dispose()

**Validation:** Interface defined and exported

### Task 7.2: Wrap Head Tracking as Input Source
- [ ] Create HeadTrackingInput class implementing interface
- [ ] Wrap existing useHeadTracking logic
- [ ] Maintain all current functionality

**Validation:** Head tracking works through new abstraction

### Task 7.3: Implement Gyroscope Input
- [ ] Create GyroscopeInput class
- [ ] Map device orientation to x/y position
- [ ] Handle iOS permission request

**Validation:** Tilting phone moves the view

### Task 7.4: Implement Touch Input
- [ ] Create TouchDragInput class
- [ ] Map touch drag to x/y position
- [ ] Return to center on release

**Validation:** Dragging finger moves the view

### Task 7.5: Add Mobile Detection
- [ ] Create useMobileDetection hook
- [ ] Detect touch capability, gyroscope availability
- [ ] Auto-select appropriate input source

**Validation:** Mobile devices get gyro/touch, desktop gets head tracking

---

## Phase 8: Animation Export

### Task 8.1: Create Animation Store
- [ ] Create `src/stores/animationStore.ts`
- [ ] State: startKeyframe, endKeyframe, duration, easing, resolution
- [ ] Actions: setStart, setEnd, updateConfig

**Validation:** Store works

### Task 8.2: Create Keyframe Capture UI
- [ ] Add "Set Start" / "Set End" buttons in orbit mode
- [ ] Capture camera position and quaternion
- [ ] Show checkmarks when set

**Validation:** Can set start and end positions

### Task 8.3: Implement Camera Interpolation
- [ ] Create interpolateCamera function
- [ ] Use Vector3.lerp for position
- [ ] Use Quaternion.slerp for rotation
- [ ] Support all easing types

**Validation:** Preview animation plays smoothly

### Task 8.4: Add Cubic Bezier Editor
- [ ] Create BezierEditor component
- [ ] Visual curve editor with draggable control points
- [ ] Output [p1x, p1y, p2x, p2y] values

**Validation:** Can create custom easing curves

### Task 8.5: Implement Preview Loop
- [ ] Add Preview button
- [ ] Loop animation in viewer
- [ ] Play/Pause controls

**Validation:** Animation previews correctly

### Task 8.6: Integrate ffmpeg.wasm
- [ ] Lazy load ffmpeg.wasm on first export
- [ ] Render frames to canvas
- [ ] Encode to MP4

**Validation:** Exports working MP4 file

### Task 8.7: Add Export Progress UI
- [ ] Show frame rendering progress
- [ ] Show encoding progress
- [ ] Download when complete

**Validation:** Full export flow works

---

## Phase 9: Vercel Deployment

### Task 9.1: Create Backend Status Hook
- [ ] Create `src/hooks/useBackendStatus.ts`
- [ ] Poll localhost:8000 every 5 seconds
- [ ] Return: connected, checking, offline

**Validation:** Hook correctly detects backend status

### Task 9.2: Create Viewer-Only Mode
- [ ] Disable image upload when backend offline
- [ ] Show "Viewer Only" badge
- [ ] .splat/.ply files still work

**Validation:** App usable without backend for viewing

### Task 9.3: Create Install Script
- [ ] Create `public/install.sh`
- [ ] Check Python version
- [ ] Create venv, install dependencies
- [ ] Download SHARP model
- [ ] Create splat-backend CLI command

**Validation:** Fresh Mac can run script and start backend

### Task 9.4: Create Setup Modal
- [ ] Create SetupModal component
- [ ] Show when backend offline and user tries image upload
- [ ] Display install command with copy button

**Validation:** User can easily copy install command

### Task 9.5: Configure Vercel
- [ ] Create vercel.json with COOP/COEP headers
- [ ] Test deployment
- [ ] Verify SharedArrayBuffer works

**Validation:** App works on Vercel domain

---

## Validation Checkpoints

After each phase, run these checks:

```bash
# Build passes
npm run build

# No TypeScript errors
npx tsc --noEmit

# Lint passes
npm run lint

# App runs
npm run dev
# Test: Can load .splat file
# Test: Can convert image (if backend running)
# Test: Head tracking works
# Test: Settings persist
```

---

## Progress Tracker

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 0: Library Migration | Not Started | | |
| Phase 1: Component Extraction | Not Started | | |
| Phase 2: State Management | Not Started | | |
| Phase 3: Settings UX | Not Started | | |
| Phase 4: Performance | Not Started | | |
| Phase 5: Backend | Not Started | | |
| Phase 6: CSS Consolidation | Not Started | | |
| Phase 7: Input Abstraction | Not Started | | |
| Phase 8: Animation Export | Not Started | | |
| Phase 9: Vercel Deploy | Not Started | | |

---

## Notes for Claude

1. **Always validate before moving on** - If something breaks, fix it immediately
2. **Commit frequently** - After each task, commit with descriptive message
3. **Keep the app working** - Never leave it in a broken state
4. **Update checkboxes** - Mark tasks complete as you go
5. **Test in browser** - Don't just check TypeScript, actually run the app
6. **Ask if stuck** - If a task is unclear, ask for clarification

---

*This plan is designed for autonomous execution. Work through it systematically.*
