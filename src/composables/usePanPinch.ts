type PointerPosition = { x: number; y: number };

type PanPinchCallbacks = {
  onPan: (deltaY: number) => void;
  onPinchStart: (centerY: number) => void;
  onPinch: (scale: number, centerY: number) => void;
};

export function usePanPinch(callbacks: PanPinchCallbacks) {
  const pointers = new Map<number, PointerPosition>();
  let lastPanY = 0;
  let pinchStartDistance = 0;

  function pointerPair() {
    return [...pointers.values()] as [PointerPosition, PointerPosition];
  }

  function distance([a, b]: [PointerPosition, PointerPosition]) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function centerY([a, b]: [PointerPosition, PointerPosition]) {
    return (a.y + b.y) / 2;
  }

  function startPinch() {
    const pair = pointerPair();
    pinchStartDistance = distance(pair);
    if (pinchStartDistance > 0) callbacks.onPinchStart(centerY(pair));
  }

  function onPointerDown(event: PointerEvent) {
    // Additional fingers do not affect the active gesture.
    if (pointers.size >= 2) return;

    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    if (pointers.size === 1) {
      lastPanY = event.clientY;
    } else {
      startPinch();
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.size === 2) {
      const pair = pointerPair();
      const currentDistance = distance(pair);
      if (pinchStartDistance > 0 && currentDistance > 0) {
        callbacks.onPinch(currentDistance / pinchStartDistance, centerY(pair));
      }
      return;
    }

    const deltaY = event.clientY - lastPanY;
    lastPanY = event.clientY;
    callbacks.onPan(deltaY);
  }

  function onPointerEnd(event: PointerEvent) {
    if (!pointers.delete(event.pointerId)) return;

    pinchStartDistance = 0;
    if (pointers.size === 1) {
      lastPanY = pointers.values().next().value!.y;
    }
  }

  return {
    pointerdown: onPointerDown,
    pointermove: onPointerMove,
    pointerup: onPointerEnd,
    pointercancel: onPointerEnd,
    lostpointercapture: onPointerEnd,
  };
}
