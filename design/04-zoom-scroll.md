# Slice 04: Frequency Zoom & Scroll

## Goal

Let the user zoom and pan the frequency axis of the spectrogram, and optionally auto-follow the detected pitch.

## Behaviour

1. Default view: 2 octaves centered on the vocal range (~130 Hz – ~520 Hz, C3–C5).
2. Scroll wheel / pinch zooms in discrete steps: 1, 2, 3 octaves, etc. Zoom centers on cursor frequency.
3. Vertical drag pans the frequency range.
4. Piano roll and pitch line respect the visible range.
5. "Follow" toggle: auto-scroll to keep detected pitch visible.

## Follow behaviour

- Only scroll when pitch clarity exceeds a threshold (~0.8).
- Only scroll when pitch leaves the middle 60% of the view.
- Use exponential moving average on pitch to ignore brief jumps.
- Lerp view toward centering the smoothed pitch each frame. Keep zoom level unchanged.
- Panning or zooming disables follow (unchecks the toggle).

## Approach

- `viewMinFreq` / `viewMaxFreq` refs replace fixed MIN_FREQ / Nyquist in `freqToY` / `yToFreq`.
- Wheel: anchor frequency at cursor y, zoom around it. Pinch fires wheel with `ctrlKey` — same handler.
- Drag: convert vertical pixel delta to frequency delta, shift view range.
- Follow: lerp view toward centering pitch each frame. Manual-interaction timestamp gates it.
- Clamp to 20 Hz – Nyquist.
