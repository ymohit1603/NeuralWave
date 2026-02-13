const EPSILON_SECONDS = 0.001;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export interface TrimRangeSeconds {
  start: number;
  end: number;
}

export function normalizeTrimRange(
  range: TrimRangeSeconds,
  duration: number,
): TrimRangeSeconds {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Audio duration is invalid.");
  }

  const safeStart = clamp(range.start, 0, duration);
  const safeEnd = clamp(range.end, 0, duration);
  const start = Math.min(safeStart, safeEnd);
  const end = Math.max(safeStart, safeEnd);

  if (end - start <= EPSILON_SECONDS) {
    throw new Error("Trim range is too short.");
  }

  return { start, end };
}

export function trimAudioBuffer(
  sourceBuffer: AudioBuffer,
  range: TrimRangeSeconds,
): AudioBuffer {
  const { start, end } = normalizeTrimRange(range, sourceBuffer.duration);
  const startSample = Math.floor(start * sourceBuffer.sampleRate);
  const endSample = Math.min(sourceBuffer.length, Math.ceil(end * sourceBuffer.sampleRate));
  const frameCount = endSample - startSample;

  if (frameCount <= 0) {
    throw new Error("Trim produced an empty clip.");
  }

  const trimmedBuffer = new AudioBuffer({
    numberOfChannels: sourceBuffer.numberOfChannels,
    length: frameCount,
    sampleRate: sourceBuffer.sampleRate,
  });

  for (let channel = 0; channel < sourceBuffer.numberOfChannels; channel++) {
    const sourceChannelData = sourceBuffer.getChannelData(channel);
    const targetChannelData = trimmedBuffer.getChannelData(channel);
    targetChannelData.set(sourceChannelData.subarray(startSample, endSample));
  }

  return trimmedBuffer;
}
