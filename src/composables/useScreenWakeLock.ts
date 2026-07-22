import { onMounted, onUnmounted, watch } from "vue";

export function useScreenWakeLock(active: () => boolean) {
  let wakeLock: WakeLockSentinel | null = null;
  let requestPending = false;
  let disposed = false;

  const shouldHoldLock = () =>
    !disposed && active() && document.visibilityState === "visible";

  async function acquire() {
    if (
      !shouldHoldLock() ||
      wakeLock ||
      requestPending ||
      !("wakeLock" in navigator)
    ) return;

    requestPending = true;
    try {
      const lock = await navigator.wakeLock.request("screen");

      // Capture may have stopped or the page may have become hidden while
      // the browser was resolving the request.
      if (!shouldHoldLock()) {
        await lock.release();
        return;
      }

      wakeLock = lock;
      lock.addEventListener("release", () => {
        if (wakeLock === lock) wakeLock = null;
      }, { once: true });
    } catch (error) {
      // Browsers may reject wake locks because of user or power settings.
      console.warn("Unable to keep the screen awake", error);
    } finally {
      requestPending = false;
    }
  }

  async function release() {
    const lock = wakeLock;
    wakeLock = null;
    if (!lock || lock.released) return;

    try {
      await lock.release();
    } catch (error) {
      console.warn("Unable to release the screen wake lock", error);
    }
  }

  function sync() {
    if (shouldHoldLock()) void acquire();
    else void release();
  }

  onMounted(() => {
    document.addEventListener("visibilitychange", sync);
    sync();
  });

  watch(active, sync);

  onUnmounted(() => {
    disposed = true;
    document.removeEventListener("visibilitychange", sync);
    void release();
  });
}
