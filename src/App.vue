<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useAudioStore } from "./stores/audio";

const audio = useAudioStore();
const canvas = ref<HTMLCanvasElement>();
let rafId = 0;

function resize() {
  const el = canvas.value;
  if (!el) return;
  el.width = window.innerWidth;
  el.height = window.innerHeight;
}

onMounted(() => {
  resize();
  window.addEventListener("resize", resize);
});
onUnmounted(() => window.removeEventListener("resize", resize));

function draw() {
  const analyser = audio.getAnalyser();
  const el = canvas.value;
  if (!analyser || !el) return;

  const ctx = el.getContext("2d")!;
  const data = new Uint8Array(analyser.frequencyBinCount);

  const loop = () => {
    const { width, height } = el;
    const col = ctx.createImageData(1, height);

    analyser.getByteFrequencyData(data);

    // Shift existing image left by 1px
    const img = ctx.getImageData(1, 0, width - 1, height);
    ctx.putImageData(img, 0, 0);

    // Draw new column on the right edge
    for (let y = 0; y < height; y++) {
      const bin = Math.floor(((height - 1 - y) / height) * data.length);
      const intensity = data[bin] / 255;
      const px = y * 4;
      if (intensity < 0.33) {
        const t = intensity / 0.33;
        col.data[px] = 0;
        col.data[px + 1] = 0;
        col.data[px + 2] = Math.floor(t * 255);
      } else if (intensity < 0.66) {
        const t = (intensity - 0.33) / 0.33;
        col.data[px] = Math.floor(t * 255);
        col.data[px + 1] = Math.floor(t * 255);
        col.data[px + 2] = 255;
      } else {
        const t = (intensity - 0.66) / 0.34;
        col.data[px] = 255;
        col.data[px + 1] = 255;
        col.data[px + 2] = Math.floor(255 - t * 128);
      }
      col.data[px + 3] = 255;
    }
    ctx.putImageData(col, width - 1, 0);

    rafId = requestAnimationFrame(loop);
  };
  loop();
}

watch(
  () => audio.running,
  (running) => {
    if (running) {
      draw();
    } else {
      cancelAnimationFrame(rafId);
    }
  },
);
</script>

<template>
  <canvas ref="canvas" class="fixed inset-0"></canvas>
  <header class="fixed top-0 right-0  ">
    <button @click="audio.running ? audio.stop() : audio.start()"
      class="rounded-lg m-4 z-10 py-2 px-4 bg-stone-200 text-stone-800 text-lg font-semibold">
      {{ audio.running ? "Stop" : "Start" }}
    </button>
  </header>
</template>
