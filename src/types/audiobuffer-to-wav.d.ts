declare module 'audiobuffer-to-wav' {
  interface ToWavOptions {
    float32?: boolean;
  }

  function toWav(audioBuffer: AudioBuffer, options?: ToWavOptions): ArrayBuffer;
  
  export = toWav;
}
