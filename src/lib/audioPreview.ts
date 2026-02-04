/**
 * Audio Preview Manager
 * Handles preview playback with time limits for non-subscribers
 */

export const PREVIEW_DURATION = 30; // seconds

/**
 * Create a limited preview buffer from full audio buffer
 */
export function createPreviewBuffer(
  audioBuffer: AudioBuffer,
  previewDuration: number = PREVIEW_DURATION
): AudioBuffer {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  // Calculate preview length in samples
  const previewLength = Math.min(
    Math.floor(previewDuration * audioBuffer.sampleRate),
    audioBuffer.length
  );

  // Create new buffer for preview
  const previewBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    previewLength,
    audioBuffer.sampleRate
  );

  // Copy preview portion from original buffer
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const previewData = previewBuffer.getChannelData(channel);
    
    for (let i = 0; i < previewLength; i++) {
      previewData[i] = originalData[i];
    }
  }

  return previewBuffer;
}

/**
 * Apply fade out to prevent abrupt ending
 */
export function applyFadeOut(
  audioBuffer: AudioBuffer,
  fadeDuration: number = 2
): AudioBuffer {
  const fadeLength = Math.floor(fadeDuration * audioBuffer.sampleRate);
  const startFade = audioBuffer.length - fadeLength;

  // Create a copy of the buffer
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  const fadedBuffer = audioContext.createBuffer(
    audioBuffer.numberOfChannels,
    audioBuffer.length,
    audioBuffer.sampleRate
  );

  // Copy and apply fade
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const originalData = audioBuffer.getChannelData(channel);
    const fadedData = fadedBuffer.getChannelData(channel);
    
    for (let i = 0; i < audioBuffer.length; i++) {
      if (i < startFade) {
        // No fade, copy as is
        fadedData[i] = originalData[i];
      } else {
        // Apply linear fade out
        const fadeProgress = (i - startFade) / fadeLength;
        const gain = 1 - fadeProgress;
        fadedData[i] = originalData[i] * gain;
      }
    }
  }

  return fadedBuffer;
}

/**
 * Create preview with fade out
 */
export function createPreviewWithFade(
  audioBuffer: AudioBuffer,
  previewDuration: number = PREVIEW_DURATION,
  fadeDuration: number = 2
): AudioBuffer {
  const previewBuffer = createPreviewBuffer(audioBuffer, previewDuration);
  return applyFadeOut(previewBuffer, fadeDuration);
}

/**
 * Format time for display (MM:SS)
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds);
  const secs = Math.floor((seconds % 1) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if preview time limit reached
 */
export function isPreviewLimitReached(currentTime: number, previewDuration: number = PREVIEW_DURATION): boolean {
  return currentTime >= previewDuration;
}
