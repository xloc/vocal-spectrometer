# Slice 03: Piano Roll Overlay

## Goal

Draw piano note labels and horizontal guide lines on the spectrogram so the user can visually map frequencies to musical notes.

## Behaviour

1. Horizontal lines span the full viewport width at each note's y-position.
2. Note labels (e.g. "C4", "A4") appear on both the left and right edges.
3. Lines and labels stay fixed — they don't scroll with the spectrogram.
4. On window resize, positions update to match the new canvas geometry.
5. Show all chromatic notes (C, D, E, F, G, A, B) with octave numbers. Skip sharps/flats to keep it readable.

## Approach

- Use an HTML overlay (`position: absolute`) on top of the canvas.
- Generate note frequencies from A0 (27.5 Hz) upward using `freq = 27.5 * 2^((midi - 21) / 12)`. Only include natural notes (white keys).
- For each note, compute y-position using the existing `freqToY` mapping. Skip notes outside the visible range.
- Each note renders as a full-width `<div>` positioned at its y-coordinate, with a thin border as the guide line and labels on both sides.
- Recompute positions on resize (same listener the canvas already uses).

## Styling

- Thin, low-opacity lines so the spectrogram remains readable.
- Small, subtle labels on left and right edges.

## Definition of Done

- All natural notes visible with labels on both sides and horizontal guide lines
- Positions stay accurate after window resize
- Labels don't interfere with spectrogram readability
- `pnpm build` succeeds
