<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { PitchDetector } from "pitchy";
import { useAudioStore } from "./stores/audio";

const audio = useAudioStore();
const canvas = ref<HTMLCanvasElement>();
const showSpectrogram = ref(true);
const viewportHeight = ref(window.innerHeight);
let rafId = 0;

function resize() {
  const el = canvas.value;
  if (!el) return;
  el.width = window.innerWidth;
  el.height = window.innerHeight;
  viewportHeight.value = window.innerHeight;
}

// Piano roll overlay — natural notes (white keys) from A0 to C8
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const pianoNotes = computed(() => {
  const maxFreq = audio.getSampleRate() / 2 || 24000;
  const height = viewportHeight.value;
  const notes: { name: string; y: number }[] = [];
  for (let midi = 21; midi <= 131; midi++) {
    const noteIndex = midi % 12;
    if (NOTE_NAMES[noteIndex].includes("#")) continue;
    const freq = 27.5 * Math.pow(2, (midi - 21) / 12);
    if (freq < MIN_FREQ || freq > maxFreq) continue;
    const octave = Math.floor((midi - 12) / 12);
    const y = freqToY(freq, maxFreq, height);
    if (y >= 0 && y < height) notes.push({ name: NOTE_NAMES[noteIndex] + octave, y });
  }
  return notes;
});

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

const CROSSOVER_LO = 400;
const CROSSOVER_HI = 600;

function draw() {
  const analysers = audio.getAnalysers();
  const sampleRate = audio.getSampleRate();
  const el = canvas.value;
  if (!analysers || !el || !sampleRate) return;

  const ctx2d = el.getContext("2d")!;
  const freqDataLo = new Uint8Array(analysers.lo.frequencyBinCount);
  const freqDataHi = new Uint8Array(analysers.hi.frequencyBinCount);
  const timeData = new Float32Array(analysers.lo.fftSize);
  const detector = PitchDetector.forFloat32Array(analysers.lo.fftSize);
  const maxFreq = sampleRate / 2;
  const binWidthLo = maxFreq / freqDataLo.length;
  const binWidthHi = maxFreq / freqDataHi.length;

  const loop = () => {
    const { width, height } = el;
    const col = ctx2d.createImageData(1, height);

    analysers.lo.getByteFrequencyData(freqDataLo);
    analysers.hi.getByteFrequencyData(freqDataHi);

    // Shift existing image left by 1px
    const img = ctx2d.getImageData(1, 0, width - 1, height);
    ctx2d.putImageData(img, 0, 0);

    // Draw spectrogram column (log scale, dual-resolution)
    if (showSpectrogram.value) {
      for (let y = 0; y < height; y++) {
        const freq = yToFreq(y, maxFreq, height);
        const binLo = Math.min(Math.floor(freq / binWidthLo), freqDataLo.length - 1);
        const binHi = Math.min(Math.floor(freq / binWidthHi), freqDataHi.length - 1);
        const valueLo = freqDataLo[binLo] / 255;
        const valueHi = freqDataHi[binHi] / 255;
        // Crossfade between lo and hi analysers over the transition band
        const blend =
          freq <= CROSSOVER_LO ? 0
            : freq >= CROSSOVER_HI ? 1
              : (freq - CROSSOVER_LO) / (CROSSOVER_HI - CROSSOVER_LO);
        const intensity = valueLo * (1 - blend) + valueHi * blend;
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
    }

    // Pitch detection — draw orange line at detected pitch, opacity = clarity
    analysers.lo.getFloatTimeDomainData(timeData);
    const [pitch, clarity] = detector.findPitch(timeData, sampleRate);
    if (pitch >= MIN_FREQ && pitch < maxFreq) {
      const pitchY = freqToY(pitch, maxFreq, height);
      const alpha = Math.floor(clarity * 255);
      for (let dy = -1; dy <= 1; dy++) {
        const y = pitchY + dy;
        if (y >= 0 && y < height) {
          const px = y * 4;
          col.data[px] = 255;
          col.data[px + 1] = 165;
          col.data[px + 2] = 0;
          col.data[px + 3] = alpha;
        }
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
  <div class="fixed inset-0">
    <div v-for="note in pianoNotes" :key="note.name"
      :style="{ position: 'absolute', top: note.y + 'px', left: 0, right: 0, display: 'flex', alignItems: 'center', transform: 'translateY(-50%)' }">
      <span class="text-stone-500 font-mono" style="font-size: 11px; padding: 0 4px; flex-shrink: 0;">{{ note.name
      }}</span>
      <span class="flex-1 border-t"
        :class="[note.name.startsWith('C') ? 'border-stone-200/50' : 'border-stone-500/50']"></span>
      <span class="text-stone-500 font-mono" style="font-size: 11px; padding: 0 4px; flex-shrink: 0;">{{ note.name
      }}</span>
    </div>
  </div>
  <header class="fixed top-0 right-0 flex">
    <label class="m-4 z-10 text-stone-800 text-lg flex items-center gap-2 bg-stone-200 rounded-lg px-4 py-2">
      <input type="checkbox" v-model="showSpectrogram" />
      Spectrogram
    </label>
    <button @click="audio.running ? audio.stop() : audio.start()"
      class="rounded-lg m-4 z-10 py-2 px-4 bg-stone-200 text-stone-800 text-lg font-semibold">
      {{ audio.running ? "Stop" : "Start" }}
    </button>

  </header>
</template>
