import { ref } from "vue";
import { defineStore } from "pinia";

export const useAudioStore = defineStore("audio", () => {
  const running = ref(false);

  let ctx: AudioContext | null = null;
  let analyserLo: AnalyserNode | null = null;
  let analyserHi: AnalyserNode | null = null;
  let stream: MediaStream | null = null;

  function getAnalysers() {
    return analyserLo && analyserHi ? { lo: analyserLo, hi: analyserHi } : null;
  }

  function getSampleRate() {
    return ctx?.sampleRate ?? 0;
  }

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);

    analyserLo = ctx.createAnalyser();
    analyserLo.fftSize = 8192;
    source.connect(analyserLo);

    analyserHi = ctx.createAnalyser();
    analyserHi.fftSize = 2048;
    source.connect(analyserHi);

    running.value = true;
  }

  function stop() {
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close();
    stream = null;
    ctx = null;
    analyserLo = null;
    analyserHi = null;
    running.value = false;
  }

  return { running, getAnalysers, getSampleRate, start, stop };
});
