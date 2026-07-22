import { onMounted, onUnmounted, ref, type Ref } from "vue";

export function useCanvasViewport(
  canvas: Ref<HTMLCanvasElement | undefined>,
  afterResize?: (canvas: HTMLCanvasElement) => void,
) {
  const height = ref(window.innerHeight);

  function resize() {
    const el = canvas.value;
    if (!el) return;

    const viewport = window.visualViewport;
    const width = Math.round(viewport?.width ?? window.innerWidth);
    const viewportHeight = Math.round(viewport?.height ?? window.innerHeight);

    el.style.width = `${width}px`;
    el.style.height = `${viewportHeight}px`;
    el.width = width;
    el.height = viewportHeight;
    height.value = viewportHeight;
    afterResize?.(el);
  }

  onMounted(() => {
    resize();
    window.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("resize", resize);
  });

  onUnmounted(() => {
    window.removeEventListener("resize", resize);
    window.visualViewport?.removeEventListener("resize", resize);
  });

  return { height };
}
