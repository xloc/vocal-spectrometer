# Mobile and Tablet Improvements

## Goal

Make Vocal Spectrometer comfortable, reliable, and performant on phones and tablets in portrait and landscape orientations.

## Priorities

### 1. Canvas sizing and rotation — Partially done

- [ ] Account for `devicePixelRatio` so the canvas remains sharp on high-density displays. Deliberately deferred: the spectrogram renders at CSS-pixel resolution to keep the renderer simple and reduce mobile rendering cost.
- [x] Cap the rendering resolution where needed to protect performance on mobile devices. The canvas uses one backing pixel per CSS pixel.
- [x] Use the visual viewport or dynamic viewport units so browser chrome does not obscure the app.
- [x] Respect safe-area insets around notches, rounded corners, and home indicators.
- [x] Redraw retained history immediately after resizing or changing orientation.

### 2. Touch navigation — Done

- [x] Use one-finger vertical dragging to pan the frequency range.
- [x] Use a two-finger pinch gesture to zoom continuously around the gesture center.
- [x] Prevent browser scrolling and zooming only while interacting with the canvas.
- [x] Handle multiple pointers, `pointercancel`, and lost pointer capture.
- [x] Disable automatic pitch following after manual pan or zoom.
- [x] Add a control that resets the view to the default vocal range.

### 3. Mobile controls — Partially done

- [ ] Give controls touch targets of at least approximately 44 by 44 CSS pixels.
- [x] Position controls within safe-area boundaries.
- [ ] Use a bottom toolbar on narrow portrait screens for easier thumb access.
- [x] Keep the live pitch label clear of the toolbar and device safe areas.
- [ ] Communicate selected states using more than color alone.
- [ ] Consider placing secondary controls in a compact menu on narrow screens.

### 4. Initial and error states

- Show brief instructions before capture begins, such as:

  > Tap the microphone to start  
  > Drag to move · Pinch to zoom

- Show when microphone permission is being requested.
- Explain when microphone permission is denied and how the user can recover.
- Show useful messages when no microphone is available or audio startup fails.

### 5. Performance and battery life

- Profile canvas rendering on representative phones and tablets.
- Consider limiting visualization updates to a stable rate such as 30 frames per second on mobile.
- Reuse spectrum and time-domain buffers instead of allocating them every frame.
- Reduce or replace the full-height `getImageData()` and `putImageData()` canvas shift if profiling identifies it as a bottleneck.
- Pause audio visualization while the page is hidden.
- Keep retained history aligned with the current canvas width after resizing.
- Avoid repeated full-history redraws during an active pinch gesture.

### 6. Microphone lifecycle

- Request audio constraints suited to analysis, potentially disabling echo cancellation, noise suppression, and automatic gain control where supported.
- Resume a suspended `AudioContext` following a user interaction.
- Handle interruptions caused by calls, backgrounding, Bluetooth changes, and audio-device changes.
- Prevent repeated Start taps from creating overlapping microphone requests.
- Preserve the existing behavior of holding a screen wake lock only during active capture.

### 7. Responsive overlays

- Reduce note-label density on short or narrow screens.
- Give labels enough contrast over bright spectrogram pixels, using a subtle background or text shadow if necessary.
- Scale the pitch label for narrow phone screens.
- Ensure overlays do not sit beneath controls or safe-area regions.
- Optimize the landscape layout for analysis without forcing device orientation.

### 8. Accessibility and polish

- Add visible keyboard focus styles.
- Provide descriptive accessible names for every control.
- Use clearer icons or short text labels where an action is ambiguous.
- Honor reduced-motion preferences where applicable.
- Use vibration only for deliberate, meaningful actions if haptic feedback is added.

## Suggested Implementation Order

1. Safe areas, dynamic viewport sizing, and a responsive toolbar.
2. Touch pan, pinch zoom, and reset-view interactions.
3. Empty, loading, permission-denied, and startup-error states.
4. High-density canvas sizing and reliable resize/orientation redraws.
5. Mobile rendering performance and audio-interruption handling.

## Definition of Done

- The primary controls are reachable and unobscured on common phone and tablet layouts.
- Pan and zoom work reliably with touch without moving the surrounding browser page.
- The canvas remains correctly sized and rendered after orientation changes.
- Microphone permission and startup failures produce understandable user feedback.
- Capture remains responsive without excessive heat or battery drain during an extended mobile session.
- Existing desktop mouse, wheel, keyboard, pitch-following, and PWA behavior continues to work.
