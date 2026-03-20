# Build Contract: Vocal Spectrometer

## Goal

Build a frontend-only vocal spectrum visualizer that captures microphone input and displays a real-time frequency spectrum

## User Stories

As a user, I can:
1. Open the app and grant microphone access to start capturing audio.
2. See a real-time frequency spectrum of my voice with piano keys labeling the frequency axis.
3. See which note I'm currently singing via pitch detection.
4. Stop and restart the audio capture.

## Definition of Done

- `pnpm dev` starts a working dev server
- `pnpm build` produces a static `dist/` deployable to GitHub Pages
- All user stories are working

## Constraints

- Frontend-only (no backend server), github-pages deployable
- pnpm + Vite + Vue 3 (TypeScript) + Pinia + Tailwind CSS

## Not Doing

- No audio recording or file export
- No multi-track or multi-source support
