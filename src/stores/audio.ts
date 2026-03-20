import { ref } from "vue";
import { defineStore } from "pinia";

export const useAudioStore = defineStore("audio", () => {
  const running = ref(false);

  let ctx: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let stream: MediaStream | null = null;

  function getAnalyser() {
    return analyser;
  }

  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    ctx = new AudioContext();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    ctx.createMediaStreamSource(stream).connect(analyser);
    running.value = true;
  }

  function stop() {
    stream?.getTracks().forEach((t) => t.stop());
    ctx?.close();
    stream = null;
    ctx = null;
    analyser = null;
    running.value = false;
  }

  return { running, getAnalyser, start, stop };
});
