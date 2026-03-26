<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { PitchDetector } from "pitchy";
import { useAudioStore } from "./stores/audio";
import { ViewfinderCircleIcon, SignalIcon, MicrophoneIcon, StopIcon } from "@heroicons/vue/24/solid";

const audio = useAudioStore();
const canvas = ref<HTMLCanvasElement>();
const showSpectrogram = ref(true);
const follow = ref(false);
const viewportHeight = ref(window.innerHeight);
let rafId = 0;

const ABS_MIN = 20;
// Default view: 2 octaves centered on vocal range (C3–C5)
const viewMinFreq = ref(130.81); // C3
const viewMaxFreq = ref(523.25); // C5

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
  // Access reactive deps: view range + viewport height
  const vMin = viewMinFreq.value;
  const vMax = viewMaxFreq.value;
  const height = viewportHeight.value;
  const notes: { name: string; y: number }[] = [];
  for (let midi = 21; midi <= 131; midi++) {
    const noteIndex = midi % 12;
    if (NOTE_NAMES[noteIndex].includes("#")) continue;
    const freq = 27.5 * Math.pow(2, (midi - 21) / 12);
    if (freq < vMin * 0.5 || freq > vMax * 2) continue; // skip far out-of-range notes
    const octave = Math.floor((midi - 12) / 12);
    const y = freqToY(freq, height);
    if (y >= 0 && y < height) notes.push({ name: NOTE_NAMES[noteIndex] + octave, y });
  }
  return notes;
});

onMounted(() => {
  resize();
  window.addEventListener("resize", resize);
});
onUnmounted(() => window.removeEventListener("resize", resize));

// Map frequency to y-position (log scale, low freq at bottom)
function freqToY(freq: number, height: number) {
  const logMin = Math.log(viewMinFreq.value);
  const logMax = Math.log(viewMaxFreq.value);
  const t = (Math.log(Math.max(freq, ABS_MIN)) - logMin) / (logMax - logMin);
  return Math.round(height - 1 - t * (height - 1));
}

// Map y-position to frequency (inverse of freqToY)
function yToFreq(y: number, height: number) {
  const logMin = Math.log(viewMinFreq.value);
  const logMax = Math.log(viewMaxFreq.value);
  const t = (height - 1 - y) / (height - 1);
  return Math.exp(logMin + t * (logMax - logMin));
}

function clampView() {
  const nyquist = (audio.getSampleRate() || 48000) / 2;
  if (viewMinFreq.value < ABS_MIN) {
    const ratio = viewMaxFreq.value / viewMinFreq.value;
    viewMinFreq.value = ABS_MIN;
    viewMaxFreq.value = ABS_MIN * ratio;
  }
  if (viewMaxFreq.value > nyquist) {
    const ratio = viewMaxFreq.value / viewMinFreq.value;
    viewMaxFreq.value = nyquist;
    viewMinFreq.value = nyquist / ratio;
  }
  viewMinFreq.value = Math.max(viewMinFreq.value, ABS_MIN);
  viewMaxFreq.value = Math.min(viewMaxFreq.value, nyquist);
}

// Wheel zoom: discrete octave steps, centered on cursor frequency
let lastZoomTime = 0;
const ZOOM_COOLDOWN = 200;

function onWheel(e: WheelEvent) {
  e.preventDefault();
  follow.value = false;
  const height = canvas.value?.height ?? window.innerHeight;

  if (e.metaKey || e.ctrlKey) {
    // Cmd/Ctrl + scroll: zoom
    const now = performance.now();
    if (now - lastZoomTime < ZOOM_COOLDOWN) return;
    lastZoomTime = now;
    const anchorFreq = yToFreq(e.offsetY, height);
    const currentOctaves = Math.round(Math.log2(viewMaxFreq.value / viewMinFreq.value));
    const direction = e.deltaY > 0 ? 1 : -1;
    const newOctaves = Math.max(1, currentOctaves + direction);
    if (newOctaves === currentOctaves) return;
    const t = (height - 1 - e.offsetY) / (height - 1);
    const newLogRange = newOctaves * Math.LN2;
    const logAnchor = Math.log(anchorFreq);
    viewMinFreq.value = Math.exp(logAnchor - t * newLogRange);
    viewMaxFreq.value = Math.exp(logAnchor + (1 - t) * newLogRange);
  } else {
    // Normal scroll: pan up/down
    const logRange = Math.log(viewMaxFreq.value) - Math.log(viewMinFreq.value);
    const logShift = (-e.deltaY / (height - 1)) * logRange;
    viewMinFreq.value = Math.exp(Math.log(viewMinFreq.value) + logShift);
    viewMaxFreq.value = Math.exp(Math.log(viewMaxFreq.value) + logShift);
  }
  clampView();
}

// Vertical drag panning
let dragging = false;
let lastDragY = 0;

function onPointerDown(e: PointerEvent) {
  dragging = true;
  lastDragY = e.clientY;
  (e.target as HTMLElement).setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent) {
  if (!dragging) return;
  follow.value = false;
  const height = canvas.value?.height ?? window.innerHeight;
  const dy = e.clientY - lastDragY;
  lastDragY = e.clientY;
  // Convert pixel delta to log-frequency shift
  const logRange = Math.log(viewMaxFreq.value) - Math.log(viewMinFreq.value);
  const logShift = (dy / (height - 1)) * logRange;
  viewMinFreq.value = Math.exp(Math.log(viewMinFreq.value) + logShift);
  viewMaxFreq.value = Math.exp(Math.log(viewMaxFreq.value) + logShift);
  clampView();
}

function onPointerUp() {
  dragging = false;
}

// ── Spectrogram rendering ──

const CROSSOVER_LO = 400;
const CROSSOVER_HI = 600;

type ColumnData = { lo: Uint8Array; hi: Uint8Array; pitch: number; clarity: number };
const history: ColumnData[] = [];
let smoothedPitch = 0;

// Writes one column of spectrogram + pitch into a pixel buffer.
// byteOffset/bytesPerRow address a column within either a 1px-wide or full-width ImageData.
function renderColumn(
  pixels: Uint8ClampedArray, byteOffset: number, bytesPerRow: number,
  col: ColumnData, height: number, nyquist: number,
) {
  if (showSpectrogram.value) {
    const binWidthLo = nyquist / col.lo.length;
    const binWidthHi = nyquist / col.hi.length;
    for (let y = 0; y < height; y++) {
      const freq = yToFreq(y, height);
      const binLo = Math.min(Math.floor(freq / binWidthLo), col.lo.length - 1);
      const binHi = Math.min(Math.floor(freq / binWidthHi), col.hi.length - 1);
      const valueLo = col.lo[binLo] / 255;
      const valueHi = col.hi[binHi] / 255;
      const blend =
        freq <= CROSSOVER_LO ? 0
          : freq >= CROSSOVER_HI ? 1
            : (freq - CROSSOVER_LO) / (CROSSOVER_HI - CROSSOVER_LO);
      const intensity = valueLo * (1 - blend) + valueHi * blend;
      const px = byteOffset + y * bytesPerRow;
      if (intensity < 0.33) {
        const t = intensity / 0.33;
        pixels[px] = 0; pixels[px + 1] = 0; pixels[px + 2] = Math.floor(t * 255);
      } else if (intensity < 0.66) {
        const t = (intensity - 0.33) / 0.33;
        pixels[px] = Math.floor(t * 255); pixels[px + 1] = Math.floor(t * 255); pixels[px + 2] = 255;
      } else {
        const t = (intensity - 0.66) / 0.34;
        pixels[px] = 255; pixels[px + 1] = 255; pixels[px + 2] = Math.floor(255 - t * 128);
      }
      pixels[px + 3] = 255;
    }
  }
  if (col.pitch > 0) {
    const pitchY = freqToY(col.pitch, height);
    const alpha = Math.floor(col.clarity * 255);
    for (let dy = -1; dy <= 1; dy++) {
      const y = pitchY + dy;
      if (y >= 0 && y < height) {
        const px = byteOffset + y * bytesPerRow;
        pixels[px] = 255; pixels[px + 1] = 165; pixels[px + 2] = 0; pixels[px + 3] = alpha;
      }
    }
  }
}

function renderAllColumns(
  ctx2d: CanvasRenderingContext2D, width: number, height: number, nyquist: number,
) {
  const img = ctx2d.createImageData(width, height);
  const bytesPerRow = width * 4;
  for (let i = 0; i < history.length; i++) {
    const x = width - history.length + i;
    renderColumn(img.data, x * 4, bytesPerRow, history[i], height, nyquist);
  }
  ctx2d.putImageData(img, 0, 0);
}

function renderNewColumn(
  ctx2d: CanvasRenderingContext2D, width: number, height: number, nyquist: number,
) {
  const shifted = ctx2d.getImageData(1, 0, width - 1, height);
  ctx2d.putImageData(shifted, 0, 0);
  const col = ctx2d.createImageData(1, height);
  renderColumn(col.data, 0, 4, history[history.length - 1], height, nyquist);
  ctx2d.putImageData(col, width - 1, 0);
}

function updateFollow(pitch: number, clarity: number) {
  if (!follow.value || pitch < ABS_MIN || clarity <= 0.8) return;
  smoothedPitch = smoothedPitch === 0 ? pitch : smoothedPitch * 0.9 + pitch * 0.1;
  const logSmoothed = Math.log(smoothedPitch);
  const logMin = Math.log(viewMinFreq.value);
  const logMax = Math.log(viewMaxFreq.value);
  const logRange = logMax - logMin;
  const pos = (logSmoothed - logMin) / logRange;
  if (pos < 0.2 || pos > 0.8) {
    const currentCenter = (logMin + logMax) / 2;
    const newCenter = currentCenter + (logSmoothed - currentCenter) * 0.05;
    viewMinFreq.value = Math.exp(newCenter - logRange / 2);
    viewMaxFreq.value = Math.exp(newCenter + logRange / 2);
    clampView();
  }
}

// ── Animation loop ──

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
  history.length = 0;
  let prevMin = viewMinFreq.value;
  let prevMax = viewMaxFreq.value;

  const loop = () => {
    const { width, height } = el;

    // Capture new frame
    analysers.lo.getByteFrequencyData(freqDataLo);
    analysers.hi.getByteFrequencyData(freqDataHi);
    analysers.lo.getFloatTimeDomainData(timeData);
    const [pitch, clarity] = detector.findPitch(timeData, sampleRate);
    history.push({
      lo: new Uint8Array(freqDataLo),
      hi: new Uint8Array(freqDataHi),
      pitch: pitch >= ABS_MIN && pitch < maxFreq ? pitch : 0,
      clarity,
    });
    while (history.length > width) history.shift();

    updateFollow(pitch, clarity);

    // Full redraw when view changed, otherwise shift + append
    const viewChanged = viewMinFreq.value !== prevMin || viewMaxFreq.value !== prevMax;
    prevMin = viewMinFreq.value;
    prevMax = viewMaxFreq.value;
    if (viewChanged) {
      renderAllColumns(ctx2d, width, height, maxFreq);
    } else {
      renderNewColumn(ctx2d, width, height, maxFreq);
    }

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

// Redraw existing history when view changes while not recording
watch([viewMinFreq, viewMaxFreq], () => {
  const sampleRate = audio.getSampleRate();
  if (audio.running || !history.length || !sampleRate) return;
  const el = canvas.value;
  if (!el) return;
  const ctx2d = el.getContext("2d")!;
  renderAllColumns(ctx2d, el.width, el.height, sampleRate / 2);
});
</script>

<template>
  <canvas ref="canvas" class="fixed inset-0" @wheel.prevent="onWheel" @pointerdown="onPointerDown"
    @pointermove="onPointerMove" @pointerup="onPointerUp"></canvas>
  <div class="fixed inset-0 pointer-events-none">
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
  <header class="fixed top-0 right-0 flex gap-2 p-4 z-10">
    <button @click="follow = !follow" :aria-pressed="follow" :title="follow ? 'Following pitch' : 'Follow pitch'"
      class="rounded-lg p-2" :class="follow ? 'bg-stone-800 text-stone-200' : 'bg-stone-200 text-stone-800'">
      <ViewfinderCircleIcon class="size-6" />
    </button>
    <button @click="showSpectrogram = !showSpectrogram" :aria-pressed="showSpectrogram" :title="showSpectrogram ? 'Hide spectrogram' : 'Show spectrogram'"
      class="rounded-lg p-2" :class="showSpectrogram ? 'bg-stone-800 text-stone-200' : 'bg-stone-200 text-stone-800'">
      <SignalIcon class="size-6" />
    </button>
    <button @click="audio.running ? audio.stop() : audio.start()" :title="audio.running ? 'Stop' : 'Start'"
      class="rounded-lg p-2" :class="audio.running ? 'bg-red-600 text-white' : 'bg-stone-200 text-stone-800'">
      <component :is="audio.running ? StopIcon : MicrophoneIcon" class="size-6" />
    </button>
  </header>
</template>
