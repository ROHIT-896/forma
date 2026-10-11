# FORMA — AI Handoff & Continuity Document

## 1. Project Overview & Location
- **Project Name:** FORMA — Adaptive Diet + Workout Tracker
- **Platform:** macOS Desktop App (Apple Silicon arm64). Packaged as a native `.app` and `.dmg`.
- **Absolute Workspace Path:** `/Users/rohitpnair/.gemini/antigravity/scratch/forma`
- **Installed App Location:** `/Applications/FORMA.app`
- **Database Location:** `~/Library/Application Support/forma/forma.sqlite`
- **Backups Location:** `~/Library/Application Support/forma/backups/`
- **Test Runner:** `node ./node_modules/vitest/vitest.mjs run` (26/26 tests passing)

---

## 2. Core Architecture & Strict Principles
1. **Local-First & Offline:** SQLite via `better-sqlite3` strictly in Electron's main process. Zero external API/LLM dependencies for core workout/diet logic.
2. **Context Isolation:** `contextIsolation: true`, `nodeIntegration: false`. The renderer communicates with Electron exclusively via typed IPC (`window.formaAPI`).
3. **Pure Logic Separation:** All calculation and adaptation rules live in `/src/engine` with **zero** imports from Electron, Node, or UI React libraries (cleanly portable to mobile/React Native later).
4. **Data Safety:**
   - Automatic DB backup on every launch (keeping only the latest 5 files in `userData/backups`).
   - Versioned migrations tracked via `schema_migrations` table.
5. **Rest Timing:** Must use wall-clock timestamps (`Date.now() - setLoggedTime`), **never** `setInterval` accumulators, to stay accurate across macOS sleep and background throttling.
6. **Delivery Rules:** Built phase-by-phase. After each phase: package the app (`electron-builder`), run tests, and verify the packaged app from `/Applications`.

---

## 3. What Has Been Completed So Far

### Phase 0: Scaffold, Packaging & Native Integrations ✅
- Scaffolded Electron + React 18 + Vite 6 + TypeScript 5 + Tailwind 3 stack.
- Pinned all dependencies in `package.json`.
- Generated custom high-res macOS app icon (`build/icon.icns` and `build/icon.png`).
- Configured Electron `powerSaveBlocker` (prevent display sleep during workouts) and macOS menu bar Tray timer.
- Configured `electron-builder` (APFS `.dmg` on arm64). Packaged and verified hello-world launch from `/Applications`.

### Phase 1: Schema, Seed Data & Pure Engine ✅
- **Database Migrations (`src/main/db.ts`)**:
  - Migration 1: `app_meta` & `schema_migrations`.
  - Migration 2: `user_profile`, `user_plan`, `exercises`, `foods`, `food_logs`, `water_logs`, `weight_logs`, `workouts`, `workout_sets`, `exercise_tracking_state`.
  - Auto-seeder: Populates seed catalog on first launch.
- **Seed Data (`/data`)**:
  - `data/exercises.json`: 98 science-based seed exercises with movement patterns, compound/isolation flags, cues, and substitution mappings.
  - `data/foods.json`: 32 Indian hostel/mess foods and staples with practical portion units (rotis, katoris, bowls, pieces, scoops) and protein tags.
  - `data/validate_seed.ts`: Seed validator ensuring referential integrity and schema rules.
- **Pure Engine Modules (`/src/engine`)**:
  - `diet.ts`: Mifflin-St Jeor formula, activity scaling, goal calorie adjustments, practical meal guidance by dietary type (`veg`, `non_veg`, `eggetarian`), 7-day rolling weight trend analysis (14-day flat detection).
  - `plan.ts`: Deterministic split selection (Full Body, Upper/Lower, PPL), weekly target volume (10-20 hard sets/muscle/week), beginner starting load guidance.
  - `workout.ts`: Time fitting within +/- 3.5 min tolerance (20, 30, 45, 60, 90 min), energy scaling (energy 1-2 minimal-effective dose, drops optional accessories, shorter session, never fails progression; energy 3-5 standard/full), equipment filtering (`full_gym`, `dumbbells_only`, `bodyweight_only`), smart under-trained focus selector, exercise substitution resolution.
  - `adaptation.ts`: Double progression rules (+2.5 kg barbell, +2 kg dumbbell on hitting top of range, hold load to build reps, 10% deload on 2 consecutive misses below range, 3-session stall detection, hold load if rated too hard), volume compensation capped at +2 sets/session, missed workout handling (1 missed roll forward without back-to-back same muscle, 10-day gap 15% deload, 14+ day gap 2 easy reacclimation sessions).
  - `rest.ts`: Pure timestamp rest calculation immune to macOS App Nap/sleep, outlier filtering (>600s), rushed rest detection.
- **Test Suite**: 26 unit tests in `tests/engine.test.ts` and `tests/phase0.test.ts` (100% passing).
- **Packaged App**: Verified live migration and seed populating in `/Applications/FORMA.app`.

---

## 4. Key File Tree & Roles

```
/Users/rohitpnair/.gemini/antigravity/scratch/forma/
├── build/
│   ├── icon.icns                  # macOS native application icon
│   ├── icon.png                   # 1024x1024 master icon
│   └── generate_icon.py           # Pure python icon generator
├── data/
│   ├── exercises.json             # 98 seed exercises
│   ├── foods.json                 # 32 Indian mess/hostel food items
│   ├── build_exercises.py         # Exercise builder script
│   ├── build_foods.py             # Food builder script
│   └── validate_seed.ts           # Referential integrity & schema validator
├── src/
│   ├── engine/                    # PURE LOGIC (No Electron/UI imports)
│   │   ├── types.ts               # Core domain interfaces
│   │   ├── diet.ts                # Mifflin-St Jeor, portions, weight trend
│   │   ├── plan.ts                # Workout split, weekly targets
│   │   ├── workout.ts             # Time fitting, energy scaling, exercise swap
│   │   ├── adaptation.ts          # Double progression, volume caps, missed workouts
│   │   ├── rest.ts                # Timestamp rest calculations & rest insights
│   │   └── index.ts               # Engine barrel export
│   ├── main/                      # ELECTRON MAIN PROCESS
│   │   ├── db.ts                  # better-sqlite3, migrations 1 & 2, auto-backup
│   │   └── index.ts               # Electron lifecycle, BrowserWindow, IPC, Tray, PowerBlocker
│   ├── preload/                   # PRELOAD BRIDGE
│   │   └── index.ts               # contextBridge exposing window.formaAPI
│   ├── shared/
│   │   └── types.ts               # Shared IPC contract types
│   └── renderer/                  # REACT FRONTEND
│       ├── App.tsx                # Verification UI dashboard
│       ├── main.tsx               # React DOM entry
│       └── index.css              # Tailwind CSS styles
├── tests/
│   ├── phase0.test.ts             # SQLite, WAL mode, migrations, auto-backup tests
│   └── engine.test.ts             # 24 pure engine unit tests & 12-week simulation
├── release/                       # PACKAGED BUILDS
│   ├── FORMA-0.1.0-arm64.dmg      # macOS arm64 installer DMG
│   └── mac-arm64/FORMA.app        # Packaged macOS application bundle
├── package.json                   # Pinned dependencies & build scripts
├── vite.config.ts                 # Renderer Vite config
├── vite.main.config.ts            # Main process Vite config
└── vite.preload.config.ts         # Preload Vite config
```

---

## 5. Technical Gotchas Already Solved
1. **Node 24 vs Electron 33 Native Addon ABI:**
   - Electron 33 uses ABI 130; local Node 24 uses ABI 137.
   - Solved in `src/main/db.ts`: `initDatabase` automatically checks `process.versions.electron`. If running under Vitest/Node, it uses `{ nativeBinding: ...better_sqlite3_node24.node }`. When packaged or running in Electron, it uses the standard Electron-compiled binary.
   - Backup binaries exist in `node_modules/better-sqlite3/build/Release/`.
2. **SQLite String Literals:**
   - In SQLite, string literals must use single quotes (e.g. `datetime('now')`). Double quotes `"now"` are parsed as column identifiers and throw errors.
3. **Sandbox Execution:**
   - Running scripts via `node ./node_modules/...` prevents `/usr/bin/env node` permission errors under macOS sandboxing.

---

## 6. WHERE TO CONTINUE: PHASE 2 INSTRUCTIONS

The next AI must implement **Phase 2** (from Section 11 of the project spec):
> **Phase 2: Workout generator UI, Active workout screen, Set/Rest tracking, Automatic adaptation (section 7).**

### What to Build in Phase 2:
1. **Workout Generator Screen & Today Hub Card:**
   - Inline interactive chips for **Time Available** (20, 30, 45, 60, 90 min) and **Energy Today** (1 to 5).
   - Focus picker (Push / Pull / Legs / Upper / Lower / Full Body / Auto-suggest).
   - "Start Workout" button: Calls `generateWorkoutSession` from `/src/engine/workout.ts`.
   - Exercise Swap button: Allows swapping an exercise using `getExerciseSubstitutions`.
   - Live "I'm short on time" re-fit button during or before the session.
2. **Active Workout Screen (Desktop macOS):**
   - Renders the session exercise list, order, warm-up note, target rep range, and target RIR.
   - Shows previous-session weight $\times$ reps inline per exercise.
   - Per set inputs: `weight_kg`, `reps`, optional 1-tap RIR chips (`0`, `1`, `2`, `3+`).
   - **Keyboard-first navigation**:
     - `Enter`: Log set + immediately start rest timer.
     - `Tab`: Cycle between weight, reps, RIR.
     - `Cmd + Z`: Undo last set.
     - `Space`: Skip/cancel active rest timer.
     - Large, clear click targets.
3. **Rest Timer & Native macOS Integrations:**
   - Starts rest countdown automatically upon logging a set.
   - Computes actual rest using `Date.now() - setLoggedTimestampMs`.
   - Shows live rest countdown in the macOS Menu Bar Tray via `window.formaAPI.updateTrayTimer`.
   - Fires native macOS notification and chime when rest ends via `window.formaAPI.notifyRestComplete`.
   - Engages `window.formaAPI.setPowerSaveBlocker(true)` while the session is active to prevent Mac sleep; releases it upon workout completion.
   - "Skip/Ignore this rest" button for distractions.
4. **Session Summary & Post-Workout Adaptation:**
   - Summary display: Total volume, total sets, planned vs actual duration, average rest vs planned, PR flags.
   - Rest insights: Flag if user rushed compound rest and suffered rep drop.
   - Automatic adaptation execution: Applies `calculateNextExerciseProgression` to update `exercise_tracking_state` in SQLite with human-readable reason strings (e.g. `"+2.5 kg: you hit 3x10 last time"`).
   - Saves completed workout and sets into SQLite tables `workouts` and `workout_sets`.
5. **Phase 2 Verification & Packaging:**
   - Write unit tests for set logging and active workout IPC.
   - Re-run `node ./node_modules/vitest/vitest.mjs run`.
   - Re-package the app: `node ./node_modules/electron-builder/cli.js --mac dmg --arm64`.
   - Install to `/Applications/FORMA.app` and test an active workout end-to-end.
