<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { PitchDetector } from "pitchy";
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

const MIN_FREQ = 20;

// Map frequency to y-position (log scale, low freq at bottom)
function freqToY(freq: number, maxFreq: number, height: number) {
  const logMin = Math.log(MIN_FREQ);
  const logMax = Math.log(maxFreq);
  const t = (Math.log(Math.max(freq, MIN_FREQ)) - logMin) / (logMax - logMin);
  return Math.round(height - 1 - t * (height - 1));
}

// Map y-position to frequency (inverse of freqToY)
function yToFreq(y: number, maxFreq: number, height: number) {
  const logMin = Math.log(MIN_FREQ);
  const logMax = Math.log(maxFreq);
  const t = (height - 1 - y) / (height - 1);
  return Math.exp(logMin + t * (logMax - logMin));
}

function draw() {
  const analyser = audio.getAnalyser();
  const sampleRate = audio.getSampleRate();
  const el = canvas.value;
  if (!analyser || !el || !sampleRate) return;

  const ctx2d = el.getContext("2d")!;
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const timeData = new Float32Array(analyser.fftSize);
  const detector = PitchDetector.forFloat32Array(analyser.fftSize);
  const maxFreq = sampleRate / 2;
  const binWidth = maxFreq / freqData.length;

  const loop = () => {
    const { width, height } = el;
    const col = ctx2d.createImageData(1, height);

    analyser.getByteFrequencyData(freqData);

    // Shift existing image left by 1px
    const img = ctx2d.getImageData(1, 0, width - 1, height);
    ctx2d.putImageData(img, 0, 0);

    // Draw spectrogram column (log scale)
    for (let y = 0; y < height; y++) {
      const freq = yToFreq(y, maxFreq, height);
      const bin = Math.min(Math.floor(freq / binWidth), freqData.length - 1);
      const intensity = freqData[bin] / 255;
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

    // Pitch detection — draw orange line at detected pitch, opacity = clarity
    analyser.getFloatTimeDomainData(timeData);
    const [pitch, clarity] = detector.findPitch(timeData, sampleRate);
    if (pitch >= MIN_FREQ && pitch < maxFreq) {
      const pitchY = freqToY(pitch, maxFreq, height);
      if (pitchY >= 0 && pitchY < height) {
        const px = pitchY * 4;
        col.data[px] = 255;
        col.data[px + 1] = 165;
        col.data[px + 2] = 0;
        col.data[px + 3] = Math.floor(clarity * 255);
      }
    }

    ctx2d.putImageData(col, width - 1, 0);
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
