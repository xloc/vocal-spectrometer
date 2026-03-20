# Slice 02: Vocal Pitch Visualization

## Goal

Detect the pitch of the user's voice in real time and overlay it on the spectrogram.

## Behaviour

1. While audio is capturing, the app continuously detects the dominant pitch.
2. A pitch line is drawn on the spectrogram at the detected frequency's y-position, scrolling with the spectrogram.
3. The line's opacity maps to the clarity score — confident detection is bright, uncertain detection is faint.

## Approach

- Use the `pitchy` library for pitch detection (lightweight, browser-native, proven accuracy).
- `pitchy` operates on time-domain float data from the AnalyserNode (`getFloatTimeDomainData`).
- Each animation frame: detect pitch → draw a line on the rightmost spectrogram column at the pitch's y-position, with opacity = clarity.
- Map detected frequency to a y-position using the same frequency-to-pixel mapping as the spectrogram.

## Definition of Done

- Pitch line tracks the user's singing in real time on the spectrogram
- Dot opacity reflects detection confidence (bright = clear pitch, faint = uncertain)
- `pnpm build` succeeds
