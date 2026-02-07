import { NextRequest, NextResponse } from 'next/server';
import ytDlp from 'yt-dlp-exec';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const DOWNLOAD_TIMEOUT_MS = 120000;
const MAX_AUDIO_SIZE_BYTES = 60 * 1024 * 1024;
const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.mp4', '.webm', '.opus'] as const;
const ERROR_LOG_SNIPPET_LENGTH = 800;
const EXTRACTION_PIPELINE_VERSION = 'youtubei-browser-first-v4-2026-02-07';
const YOUTUBEI_PLAYER_ENDPOINT = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
const YT_DLP_BINARY_FILENAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const YT_DLP_ASSET_CANDIDATES = (() => {
  if (process.platform === 'win32') {
    return process.arch === 'arm64'
      ? ['yt-dlp_arm64.exe', 'yt-dlp.exe']
      : ['yt-dlp.exe'];
  }

  if (process.platform === 'linux') {
    if (process.arch === 'arm64') {
      return ['yt-dlp_linux_aarch64', 'yt-dlp_linux', 'yt-dlp'];
    }

    return ['yt-dlp_linux', 'yt-dlp'];
  }

  if (process.platform === 'darwin') {
    return ['yt-dlp_macos', 'yt-dlp_macos_legacy', 'yt-dlp'];
  }

  return ['yt-dlp'];
})();

type YtDlpRunner = (
  url: string,
  flags?: Record<string, string | number | boolean>,
  options?: { timeout?: number; windowsHide?: boolean; cwd?: string; env?: NodeJS.ProcessEnv }
) => Promise<unknown>;

let ytDlpRunnerPromise: Promise<YtDlpRunner> | null = null;

const YOUTUBEI_CLIENTS = [
  {
    label: 'android',
    userAgent: 'com.google.android.youtube/20.10.35 (Linux; U; Android 14)',
    client: {
      clientName: 'ANDROID',
      clientVersion: '20.10.35',
      hl: 'en',
      gl: 'US',
      androidSdkVersion: 34,
    },
  },
  {
    label: 'ios',
    userAgent: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3 like Mac OS X)',
    client: {
      clientName: 'IOS',
      clientVersion: '20.10.4',
      hl: 'en',
      gl: 'US',
    },
  },
] as const;

interface VideoInfo {
  title: string;
  author: string;
  lengthSeconds: number;
  audioUrl: string;
  videoId: string;
  thumbnail: string;
}

interface DownloadStrategy {
  label: string;
  flags: Record<string, string | number | boolean>;
}

interface StreamCandidate {
  url: string;
  formatId: string;
  ext: string;
  protocol: string;
  abr: number;
  sourceStrategy: string;
}

interface YouTubeiFormat {
  itag?: number;
  url?: string;
  mimeType?: string;
  qualityLabel?: string;
  contentLength?: string;
  bitrate?: number;
}

interface YouTubeiPlayerResponse {
  playabilityStatus?: {
    status?: string;
    reason?: string;
  };
  streamingData?: {
    formats?: YouTubeiFormat[];
    adaptiveFormats?: YouTubeiFormat[];
  };
}

class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getWritableTempDir(): string {
  const baseTmp = os.tmpdir();
  const appTmp = path.join(baseTmp, 'neuralwave-temp');
  fs.mkdirSync(appTmp, { recursive: true });
  return appTmp;
}

function extractVideoId(url: string): string | null {
  const normalized = url.trim();
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function getThumbnailUrl(
  videoId: string,
  quality: 'default' | 'hq' | 'mq' | 'sd' | 'maxres' = 'hq'
): string {
  const qualityMap = {
    default: 'default',
    mq: 'mqdefault',
    hq: 'hqdefault',
    sd: 'sddefault',
    maxres: 'maxresdefault',
  };

  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    const parts = [error.message];
    const maybeError = error as Error & { stderr?: string; stdout?: string; shortMessage?: string };
    if (typeof maybeError.shortMessage === 'string') parts.push(maybeError.shortMessage);
    if (typeof maybeError.stderr === 'string') parts.push(maybeError.stderr);
    if (typeof maybeError.stdout === 'string') parts.push(maybeError.stdout);
    return parts.filter(Boolean).join('\n');
  }

  return String(error ?? 'Unknown error');
}

function getErrorSnippet(message: string): string {
  return message.replace(/\s+/g, ' ').slice(0, ERROR_LOG_SNIPPET_LENGTH);
}

function hasExecutableOnPath(commandName: string): boolean {
  const pathEntries = (process.env.PATH || '').split(path.delimiter).filter(Boolean);
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
    : [''];

  for (const entry of pathEntries) {
    for (const extension of extensions) {
      const candidate = path.join(entry, process.platform === 'win32' ? `${commandName}${extension}` : commandName);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return true;
      } catch {
        // Keep scanning PATH.
      }
    }
  }

  return false;
}

function isBinaryUsable(binaryPath: string): boolean {
  try {
    const mode = process.platform === 'win32' ? fs.constants.F_OK : fs.constants.X_OK;
    fs.accessSync(binaryPath, mode);
    return true;
  } catch {
    return false;
  }
}

function isPythonShebang(binaryPath: string): boolean {
  let fd: number | null = null;

  try {
    fd = fs.openSync(binaryPath, 'r');
    const buffer = Buffer.alloc(128);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    const head = buffer.toString('utf8', 0, bytesRead);
    return /^#!.*python/i.test(head);
  } catch {
    return false;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // Ignore descriptor cleanup failures.
      }
    }
  }
}

function probeYtDlpBinary(binaryPath: string): { ok: true } | { ok: false; reason: string } {
  if (!isBinaryUsable(binaryPath)) {
    return { ok: false, reason: 'Binary is missing or not executable.' };
  }

  if (isPythonShebang(binaryPath) && !hasExecutableOnPath('python3')) {
    return { ok: false, reason: 'Binary requires python3, but python3 is not available in runtime.' };
  }

  const probe = spawnSync(binaryPath, ['--version'], {
    encoding: 'utf8',
    timeout: 7000,
    windowsHide: true,
  });

  if (probe.error) {
    return { ok: false, reason: probe.error.message };
  }

  if (probe.status !== 0) {
    const stderr = typeof probe.stderr === 'string' ? probe.stderr : '';
    const stdout = typeof probe.stdout === 'string' ? probe.stdout : '';
    const details = getErrorSnippet(`${stderr}\n${stdout}`.trim());
    return { ok: false, reason: details || `Binary probe failed with exit code ${probe.status}.` };
  }

  return { ok: true };
}

function getYtDlpBinaryCandidates(): string[] {
  const candidates = [
    process.env.YT_DLP_BINARY_PATH?.trim(),
    process.env.YOUTUBE_DL_PATH?.trim(),
    path.join(process.cwd(), 'node_modules', 'yt-dlp-exec', 'bin', YT_DLP_BINARY_FILENAME),
    path.join(getWritableTempDir(), 'bin', YT_DLP_BINARY_FILENAME),
  ].filter((candidate): candidate is string => Boolean(candidate));

  return Array.from(new Set(candidates));
}

async function downloadYtDlpBinary(destinationPath: string): Promise<string> {
  const existingProbe = probeYtDlpBinary(destinationPath);
  if (existingProbe.ok) {
    return destinationPath;
  }

  let lastFailure = existingProbe.reason;

  for (const assetName of YT_DLP_ASSET_CANDIDATES) {
    const assetUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;

    try {
      const response = await fetch(assetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      });

      if (!response.ok) {
        lastFailure = `Asset ${assetName} returned HTTP ${response.status}`;
        continue;
      }

      const binaryBytes = Buffer.from(await response.arrayBuffer());
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.writeFileSync(destinationPath, binaryBytes);

      if (process.platform !== 'win32') {
        fs.chmodSync(destinationPath, 0o755);
      }

      const probe = probeYtDlpBinary(destinationPath);
      if (probe.ok) {
        console.log(`[Server] yt-dlp bootstrap asset selected: ${assetName}`);
        return destinationPath;
      }

      lastFailure = `Asset ${assetName} is unusable: ${probe.reason}`;
    } catch (error) {
      lastFailure = `Asset ${assetName} download failed: ${getErrorSnippet(getErrorText(error))}`;
    }
  }

  throw new ApiError(
    `Failed to bootstrap yt-dlp binary. ${lastFailure || 'Unknown bootstrap failure.'}`,
    503,
    'EXTRACTOR_BOOTSTRAP_FAILED'
  );
}

function createYtDlpRunner(binaryPath: string): YtDlpRunner {
  const maybeFactory = (ytDlp as unknown as { create?: (binary: string) => YtDlpRunner }).create;
  if (typeof maybeFactory === 'function') {
    return maybeFactory(binaryPath);
  }

  return ytDlp as unknown as YtDlpRunner;
}

async function getYtDlpRunner(): Promise<YtDlpRunner> {
  if (!ytDlpRunnerPromise) {
    ytDlpRunnerPromise = (async () => {
      const candidates = getYtDlpBinaryCandidates();

      for (const candidate of candidates) {
        const probe = probeYtDlpBinary(candidate);
        if (probe.ok) {
          console.log(`[Server] yt-dlp binary selected: ${candidate}`);
          return createYtDlpRunner(candidate);
        }

        console.warn(`[Server] yt-dlp candidate rejected: ${candidate} | ${probe.reason}`);
      }

      const fallbackPath = path.join(getWritableTempDir(), 'bin', YT_DLP_BINARY_FILENAME);
      const downloadedPath = await downloadYtDlpBinary(fallbackPath);
      console.log(`[Server] yt-dlp binary downloaded: ${downloadedPath}`);
      return createYtDlpRunner(downloadedPath);
    })();
  }

  try {
    return await ytDlpRunnerPromise;
  } catch (error) {
    ytDlpRunnerPromise = null;
    throw error;
  }
}

function isBotProtectionError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('sign in to confirm') ||
    normalized.includes("youre not a bot") ||
    normalized.includes("you're not a bot") ||
    normalized.includes('http error 429') ||
    normalized.includes('use --cookies')
  );
}

function isRestrictedVideoError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('video unavailable') ||
    normalized.includes('this video is private') ||
    normalized.includes('private video') ||
    normalized.includes('members-only') ||
    normalized.includes('age-restricted') ||
    normalized.includes('copyright')
  );
}

function toApiErrorFromYtDlp(message: string): ApiError {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('no supported javascript runtime') ||
    normalized.includes('challenge solver script distribution')
  ) {
    return new ApiError(
      'Extraction runtime setup is incomplete. Please retry in a moment.',
      503,
      'EXTRACTOR_RUNTIME_UNAVAILABLE'
    );
  }

  if (
    normalized.includes('gvs po token') ||
    normalized.includes('po token') ||
    normalized.includes('po_token')
  ) {
    return new ApiError(
      'This video currently needs authenticated YouTube access. Please retry, or configure cookies/PO token env vars for higher success.',
      503,
      'YOUTUBE_REQUIRES_AUTH'
    );
  }

  if (
    normalized.includes('enoent') ||
    normalized.includes('spawn') ||
    normalized.includes('eacces') ||
    normalized.includes('permission denied') ||
    normalized.includes("python3': no such file") ||
    normalized.includes('python3: no such file') ||
    normalized.includes('executable')
  ) {
    return new ApiError(
      'The extraction engine is initializing. Please retry in a few seconds.',
      503,
      'EXTRACTOR_UNAVAILABLE'
    );
  }

  if (isBotProtectionError(message)) {
    return new ApiError(
      'YouTube temporarily blocked automated access for this video. Please try another public video or retry in a few minutes.',
      503,
      'YOUTUBE_BOT_PROTECTION'
    );
  }

  if (isRestrictedVideoError(message)) {
    return new ApiError(
      'This video is unavailable, private, or restricted. Please try a different public video.',
      400,
      'VIDEO_RESTRICTED'
    );
  }

  if (
    normalized.includes('unsupported url') ||
    normalized.includes('invalid url') ||
    normalized.includes('not a valid url')
  ) {
    return new ApiError(
      'Invalid YouTube URL. Please provide a valid video link.',
      400,
      'INVALID_URL'
    );
  }

  if (
    normalized.includes('requested format is not available') ||
    normalized.includes('no video formats found')
  ) {
    return new ApiError(
      'This video has no downloadable audio stream. Please try a different video.',
      400,
      'AUDIO_FORMAT_UNAVAILABLE'
    );
  }

  if (
    normalized.includes('timed out') ||
    normalized.includes('network') ||
    normalized.includes('connection reset')
  ) {
    return new ApiError(
      'Network issue while downloading audio. Please retry in a moment.',
      503,
      'NETWORK_ERROR'
    );
  }

  return new ApiError(
    'Unable to download this video right now. Please try a different public video or try again later.',
    500,
    'DOWNLOAD_FAILED'
  );
}

async function getOEmbedInfo(url: string): Promise<{ title?: string; author?: string } | null> {
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );

    if (!response.ok) return null;

    const data = (await response.json()) as { title?: string; author_name?: string };
    return {
      title: data.title,
      author: data.author_name,
    };
  } catch {
    return null;
  }
}

function createCookiesFile(tempDir: string): { cookieFile: string | null; shouldCleanup: boolean } {
  const rawCookies = process.env.YOUTUBE_COOKIES?.trim();
  if (rawCookies) {
    const cookieFile = path.join(tempDir, `yt_cookies_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.txt`);
    fs.writeFileSync(cookieFile, rawCookies, 'utf8');
    return { cookieFile, shouldCleanup: true };
  }

  const cookieFileFromEnv = process.env.YOUTUBE_COOKIES_FILE?.trim();
  if (cookieFileFromEnv && fs.existsSync(cookieFileFromEnv)) {
    return { cookieFile: cookieFileFromEnv, shouldCleanup: false };
  }

  return { cookieFile: null, shouldCleanup: false };
}

function inferExtensionFromMimeType(mimeType: string | undefined): '.mp4' | '.webm' {
  if (!mimeType) return '.mp4';
  return mimeType.toLowerCase().includes('webm') ? '.webm' : '.mp4';
}

function inferCandidateExtFromMimeType(mimeType: string | undefined): 'mp4' | 'webm' {
  return inferExtensionFromMimeType(mimeType) === '.webm' ? 'webm' : 'mp4';
}

function parseContentLength(value: string | number | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return 0;
}

function pickBestYouTubeiProgressiveFormat(formats: YouTubeiFormat[]): YouTubeiFormat | null {
  const candidates = formats.filter((format) => {
    if (!format.url || !format.mimeType) return false;
    const mime = format.mimeType.toLowerCase();
    return mime.includes('video/mp4') || mime.includes('audio/mp4') || mime.includes('video/webm');
  });

  if (candidates.length === 0) return null;

  return candidates.sort((a, b) => {
    const aSize = parseContentLength(a.contentLength);
    const bSize = parseContentLength(b.contentLength);

    if (aSize > 0 && bSize > 0) return aSize - bSize;
    if (aSize > 0) return -1;
    if (bSize > 0) return 1;

    const aBitrate = typeof a.bitrate === 'number' ? a.bitrate : 0;
    const bBitrate = typeof b.bitrate === 'number' ? b.bitrate : 0;
    return aBitrate - bBitrate;
  })[0];
}

function extractYouTubeiStreamCandidates(
  playerResponse: YouTubeiPlayerResponse,
  sourceStrategy: string
): StreamCandidate[] {
  const formats = [
    ...(playerResponse.streamingData?.formats || []),
    ...(playerResponse.streamingData?.adaptiveFormats || []),
  ];

  const seenUrls = new Set<string>();
  const ranked: Array<StreamCandidate & { score: number }> = [];

  for (const format of formats) {
    if (!format.url) continue;
    if (seenUrls.has(format.url)) continue;

    const mime = (format.mimeType || '').toLowerCase();
    const hasAudio = mime.includes('audio/') || mime.includes('mp4a') || mime.includes('opus');
    if (!hasAudio) continue;

    const hasVideo = mime.includes('video/');
    const ext = inferCandidateExtFromMimeType(format.mimeType);
    const bitrate = typeof format.bitrate === 'number' ? format.bitrate : 0;
    const score =
      (hasVideo ? 20 : 120) +
      (ext === 'mp4' ? 15 : 10) +
      Math.min(Math.floor(bitrate / 25000), 20);

    ranked.push({
      url: format.url,
      formatId: format.itag ? String(format.itag) : 'unknown',
      ext,
      protocol: 'https',
      abr: Math.round(bitrate / 1000),
      sourceStrategy,
      score,
    });
    seenUrls.add(format.url);
  }

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score: _score, ...candidate }) => candidate);
}

async function getYouTubeiClientStreamCandidates(
  videoId: string,
  watchUrl: string
): Promise<StreamCandidate[]> {
  for (const client of YOUTUBEI_CLIENTS) {
    try {
      console.log(`[Server] YouTubei metadata strategy: ${client.label}`);
      const playerResponse = await fetchYouTubeiPlayerResponse(videoId, watchUrl, client);
      const playabilityStatus = playerResponse.playabilityStatus?.status || 'UNKNOWN';
      const playabilityReason = playerResponse.playabilityStatus?.reason || '';

      if (playabilityStatus !== 'OK') {
        console.warn(
          `[Server] YouTubei metadata ${client.label} not playable: ${playabilityStatus}${playabilityReason ? ` - ${playabilityReason}` : ''}`
        );
        continue;
      }

      const candidates = extractYouTubeiStreamCandidates(
        playerResponse,
        `youtubei-metadata:${client.label}`
      );

      if (candidates.length > 0) {
        console.log(
          `[Server] YouTubei metadata succeeded with ${candidates.length} browser candidates (${client.label})`
        );
        return candidates;
      }
    } catch (error) {
      console.warn(
        `[Server] YouTubei metadata failed for ${client.label} | ${getErrorSnippet(getErrorText(error))}`
      );
    }
  }

  return [];
}

async function fetchYouTubeiPlayerResponse(
  videoId: string,
  watchUrl: string,
  client: (typeof YOUTUBEI_CLIENTS)[number]
): Promise<YouTubeiPlayerResponse> {
  const response = await fetch(YOUTUBEI_PLAYER_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': client.userAgent,
      Referer: watchUrl,
      Origin: 'https://www.youtube.com',
    },
    body: JSON.stringify({
      context: {
        client: client.client,
      },
      videoId,
    }),
  });

  if (!response.ok) {
    throw new Error(`YouTubei HTTP ${response.status}`);
  }

  return (await response.json()) as YouTubeiPlayerResponse;
}

async function downloadFromYouTubeiMediaUrl(
  mediaUrl: string,
  watchUrl: string,
  userAgent: string,
  outputTemplate: string,
  extension: string
): Promise<string> {
  const mediaResponse = await fetch(mediaUrl, {
    headers: {
      'User-Agent': userAgent,
      Referer: watchUrl,
      Origin: 'https://www.youtube.com',
    },
  });

  if (!mediaResponse.ok) {
    throw new Error(`Media download HTTP ${mediaResponse.status}`);
  }

  const declaredSize = parseContentLength(mediaResponse.headers.get('content-length') ?? undefined);
  if (declaredSize > MAX_AUDIO_SIZE_BYTES) {
    throw new ApiError(
      'Video is too long. Please use videos under 30 minutes.',
      400,
      'VIDEO_TOO_LARGE'
    );
  }

  const mediaBytes = Buffer.from(await mediaResponse.arrayBuffer());
  if (mediaBytes.length === 0) {
    throw new Error('Media response is empty');
  }

  if (mediaBytes.length > MAX_AUDIO_SIZE_BYTES) {
    throw new ApiError(
      'Video is too long. Please use videos under 30 minutes.',
      400,
      'VIDEO_TOO_LARGE'
    );
  }

  const normalizedExtension = extension.startsWith('.') ? extension : `.${extension}`;
  const outputFile = outputTemplate.replace('.%(ext)s', normalizedExtension);
  fs.writeFileSync(outputFile, mediaBytes);
  return outputFile;
}

async function downloadWithYouTubeiDirect(
  videoId: string,
  watchUrl: string,
  outputTemplate: string
): Promise<string | null> {

  for (const client of YOUTUBEI_CLIENTS) {
    try {
      console.log(`[Server] YouTubei direct strategy: ${client.label}`);
      const playerResponse = await fetchYouTubeiPlayerResponse(videoId, watchUrl, client);
      const playabilityStatus = playerResponse.playabilityStatus?.status || 'UNKNOWN';
      const playabilityReason = playerResponse.playabilityStatus?.reason || '';

      if (playabilityStatus !== 'OK') {
        console.warn(
          `[Server] YouTubei ${client.label} not playable: ${playabilityStatus}${playabilityReason ? ` - ${playabilityReason}` : ''}`
        );
        continue;
      }

      const progressiveFormats = (playerResponse.streamingData?.formats || []).filter((format) => Boolean(format.url));
      const selectedFormat = pickBestYouTubeiProgressiveFormat(progressiveFormats);
      if (selectedFormat?.url) {
        const expectedSize = parseContentLength(selectedFormat.contentLength);
        if (expectedSize > MAX_AUDIO_SIZE_BYTES) {
          throw new ApiError(
            'Video is too long. Please use videos under 30 minutes.',
            400,
            'VIDEO_TOO_LARGE'
          );
        }

        console.log(
          `[Server] YouTubei selected format: client=${client.label}, itag=${selectedFormat.itag || 'unknown'}, mime=${selectedFormat.mimeType || 'unknown'}, size=${expectedSize || 0}`
        );

        try {
          const extension = inferExtensionFromMimeType(selectedFormat.mimeType);
          const outputFile = await downloadFromYouTubeiMediaUrl(
            selectedFormat.url,
            watchUrl,
            client.userAgent,
            outputTemplate,
            extension
          );
          console.log(`[Server] YouTubei progressive direct download successful (${client.label})`);
          return outputFile;
        } catch (progressiveError) {
          if (progressiveError instanceof ApiError) {
            throw progressiveError;
          }

          console.warn(
            `[Server] YouTubei progressive download failed for ${client.label} | ${getErrorSnippet(getErrorText(progressiveError))}`
          );
        }
      } else {
        console.warn(`[Server] YouTubei ${client.label} returned no usable progressive format`);
      }

      const streamCandidates = extractYouTubeiStreamCandidates(
        playerResponse,
        `youtubei-direct:${client.label}`
      );

      if (streamCandidates.length === 0) {
        console.warn(`[Server] YouTubei ${client.label} returned no direct stream candidates`);
        continue;
      }

      console.log(
        `[Server] YouTubei ${client.label} trying ${streamCandidates.length} direct stream candidates`
      );

      for (const candidate of streamCandidates) {
        try {
          const outputFile = await downloadFromYouTubeiMediaUrl(
            candidate.url,
            watchUrl,
            client.userAgent,
            outputTemplate,
            candidate.ext
          );

          console.log(
            `[Server] YouTubei candidate download successful (${client.label}, itag=${candidate.formatId}, ext=${candidate.ext})`
          );
          return outputFile;
        } catch (candidateError) {
          if (candidateError instanceof ApiError) {
            throw candidateError;
          }

          console.warn(
            `[Server] YouTubei candidate failed (${client.label}, itag=${candidate.formatId}) | ${getErrorSnippet(getErrorText(candidateError))}`
          );
        }
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      console.warn(
        `[Server] YouTubei direct failed for ${client.label} | ${getErrorSnippet(getErrorText(error))}`
      );
    }
  }

  return null;
}

function getNodeJsRuntimeArg(): string {
  return `node:${process.execPath}`;
}

function normalizePoToken(token: string, scope: 'web' | 'mweb' | 'android' | 'ios'): string {
  const normalized = token.trim();
  if (!normalized) return normalized;
  if (normalized.includes('+')) return normalized;
  return `${scope}.gvs+${normalized}`;
}

function buildYoutubeExtractorArgs(
  playerClient: 'web' | 'mweb' | 'web_safari' | 'android' | 'ios'
): string {
  const parts = [`youtube:player_client=${playerClient}`];
  const visitorData = process.env.YOUTUBE_VISITOR_DATA?.trim();

  const tokenByClient: Partial<Record<typeof playerClient, string | undefined>> = {
    web: process.env.YOUTUBE_WEB_PO_TOKEN,
    mweb: process.env.YOUTUBE_MWEB_PO_TOKEN,
    web_safari: process.env.YOUTUBE_WEB_PO_TOKEN,
    android: process.env.YOUTUBE_ANDROID_PO_TOKEN,
    ios: process.env.YOUTUBE_IOS_PO_TOKEN,
  };

  const rawToken = tokenByClient[playerClient]?.trim();
  if (rawToken) {
    const poScope = playerClient === 'web_safari' ? 'web' : playerClient;
    parts.push(`po_token=${normalizePoToken(rawToken, poScope as 'web' | 'mweb' | 'android' | 'ios')}`);
    if (visitorData) {
      parts.push(`visitor_data=${visitorData}`);
      parts.push('player_skip=webpage,configs');
    }
  }

  return parts.join(';');
}

function buildDownloadStrategies(outputTemplate: string, cookieFile: string | null): DownloadStrategy[] {
  const nodeRuntime = getNodeJsRuntimeArg();
  const webToken = process.env.YOUTUBE_WEB_PO_TOKEN?.trim();
  const androidToken = process.env.YOUTUBE_ANDROID_PO_TOKEN?.trim();
  const iosToken = process.env.YOUTUBE_IOS_PO_TOKEN?.trim();
  const commonFlags: Record<string, string | number | boolean> = {
    noPlaylist: true,
    ignoreConfig: true,
    geoBypass: true,
    format: 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/bestaudio',
    output: outputTemplate,
    retries: 2,
    fragmentRetries: 2,
    extractorRetries: 2,
    fileAccessRetries: 2,
    socketTimeout: 15,
    forceIpv4: true,
    noCheckCertificates: true,
    jsRuntimes: nodeRuntime,
    remoteComponents: 'ejs:github',
  };

  if (cookieFile) {
    commonFlags.cookies = cookieFile;
  }

  const strategies: DownloadStrategy[] = [
    {
      label: 'default web client',
      flags: {
        ...commonFlags,
      },
    },
    {
      label: 'mweb client',
      flags: {
        ...commonFlags,
        format: 'bestaudio/best',
        extractorArgs: buildYoutubeExtractorArgs('mweb'),
      },
    },
    {
      label: 'web_safari fallback',
      flags: {
        ...commonFlags,
        format: 'bestaudio/best',
        extractorArgs: buildYoutubeExtractorArgs('web_safari'),
      },
    },
    {
      label: 'generic bestaudio fallback',
      flags: {
        ...commonFlags,
        format: 'bestaudio/best',
      },
    },
  ];

  if (webToken) {
    strategies.unshift({
      label: 'web client (po token)',
      flags: {
        ...commonFlags,
        extractorArgs: buildYoutubeExtractorArgs('web'),
      },
    });
  }

  if (androidToken) {
    strategies.push({
      label: 'android client (po token)',
      flags: {
        ...commonFlags,
        extractorArgs: buildYoutubeExtractorArgs('android'),
      },
    });
  }

  if (iosToken) {
    strategies.push({
      label: 'ios client (po token)',
      flags: {
        ...commonFlags,
        extractorArgs: buildYoutubeExtractorArgs('ios'),
      },
    });
  }

  return strategies;
}

function buildMetadataStrategies(cookieFile: string | null): DownloadStrategy[] {
  const nodeRuntime = getNodeJsRuntimeArg();
  const webToken = process.env.YOUTUBE_WEB_PO_TOKEN?.trim();
  const androidToken = process.env.YOUTUBE_ANDROID_PO_TOKEN?.trim();
  const iosToken = process.env.YOUTUBE_IOS_PO_TOKEN?.trim();

  const commonFlags: Record<string, string | number | boolean> = {
    noPlaylist: true,
    ignoreConfig: true,
    geoBypass: true,
    dumpSingleJson: true,
    skipDownload: true,
    simulate: true,
    noWarnings: true,
    socketTimeout: 15,
    forceIpv4: true,
    noCheckCertificates: true,
    extractorRetries: 2,
    jsRuntimes: nodeRuntime,
    remoteComponents: 'ejs:github',
  };

  if (cookieFile) {
    commonFlags.cookies = cookieFile;
  }

  const strategies: DownloadStrategy[] = [
    {
      label: 'metadata default web client',
      flags: {
        ...commonFlags,
      },
    },
    {
      label: 'metadata mweb client',
      flags: {
        ...commonFlags,
        extractorArgs: buildYoutubeExtractorArgs('mweb'),
      },
    },
    {
      label: 'metadata web_safari client',
      flags: {
        ...commonFlags,
        extractorArgs: buildYoutubeExtractorArgs('web_safari'),
      },
    },
  ];

  if (webToken) {
    strategies.unshift({
      label: 'metadata web client (po token)',
      flags: {
        ...commonFlags,
        extractorArgs: buildYoutubeExtractorArgs('web'),
      },
    });
  }

  if (androidToken) {
    strategies.push({
      label: 'metadata android client (po token)',
      flags: {
        ...commonFlags,
        extractorArgs: buildYoutubeExtractorArgs('android'),
      },
    });
  }

  if (iosToken) {
    strategies.push({
      label: 'metadata ios client (po token)',
      flags: {
        ...commonFlags,
        extractorArgs: buildYoutubeExtractorArgs('ios'),
      },
    });
  }

  return strategies;
}

function extractStreamCandidatesFromYtDlpResult(
  rawResult: unknown,
  strategyLabel: string
): StreamCandidate[] {
  const parsedResult = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;
  const formats = (parsedResult as { formats?: Array<Record<string, unknown>> })?.formats || [];
  const candidates: Array<StreamCandidate & { score: number; isAudioOnly: boolean }> = [];
  const seenUrls = new Set<string>();

  for (const format of formats) {
    const url = typeof format.url === 'string' ? format.url : '';
    const acodec = typeof format.acodec === 'string' ? format.acodec : '';
    const vcodec = typeof format.vcodec === 'string' ? format.vcodec : '';
    const ext = typeof format.ext === 'string' ? format.ext : 'unknown';
    const protocol = typeof format.protocol === 'string' ? format.protocol : 'unknown';
    const formatId = typeof format.format_id === 'string' ? format.format_id : 'unknown';
    const abr = typeof format.abr === 'number' ? format.abr : 0;
    const tbr = typeof format.tbr === 'number' ? format.tbr : 0;

    if (!url || acodec === 'none') continue;
    if (seenUrls.has(url)) continue;

    const isAudioOnly = vcodec === 'none';
    const protocolScore = protocol.includes('https') ? 40 : protocol.includes('m3u8') ? 20 : 0;
    const extScore = ext === 'm4a' || ext === 'mp4' ? 30 : ext === 'webm' ? 20 : 0;
    const bitrateScore = Math.min(abr || tbr, 256) / 8;
    const audioOnlyScore = isAudioOnly ? 100 : 0;

    candidates.push({
      url,
      formatId,
      ext,
      protocol,
      abr: abr || tbr || 0,
      sourceStrategy: strategyLabel,
      score: audioOnlyScore + protocolScore + extScore + bitrateScore,
      isAudioOnly,
    });

    seenUrls.add(url);
  }

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ score: _score, isAudioOnly: _isAudioOnly, ...candidate }) => candidate);
}

async function getClientStreamCandidates(
  videoId: string,
  url: string,
  cookieFile: string | null
): Promise<StreamCandidate[]> {
  const youtubeiCandidates = await getYouTubeiClientStreamCandidates(videoId, url);
  if (youtubeiCandidates.length > 0) {
    return youtubeiCandidates;
  }

  const runner = await getYtDlpRunner();
  const strategies = buildMetadataStrategies(cookieFile);
  let lastErrorMessage = 'No stream candidates found.';

  for (const strategy of strategies) {
    try {
      console.log(`[Server] yt-dlp metadata strategy: ${strategy.label}`);
      const result = await runner(url, strategy.flags, {
        timeout: DOWNLOAD_TIMEOUT_MS,
        windowsHide: true,
      });

      const candidates = extractStreamCandidatesFromYtDlpResult(result, strategy.label);
      if (candidates.length > 0) {
        console.log(`[Server] metadata strategy succeeded with ${candidates.length} browser candidates`);
        return candidates;
      }

      lastErrorMessage = `No usable audio formats from ${strategy.label}`;
    } catch (error) {
      lastErrorMessage = getErrorText(error);
      console.warn(
        `[Server] yt-dlp metadata failed for strategy: ${strategy.label} | ${getErrorSnippet(lastErrorMessage)}`
      );
    }
  }

  throw toApiErrorFromYtDlp(lastErrorMessage);
}

function findDownloadedAudioFile(outputTemplate: string): string | null {
  const outputDir = path.dirname(outputTemplate);
  const outputPrefix = path.basename(outputTemplate).replace('.%(ext)s', '');

  for (const extension of AUDIO_EXTENSIONS) {
    const candidate = path.join(outputDir, `${outputPrefix}${extension}`);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const fallback = fs.readdirSync(outputDir).find((entry) => entry.startsWith(outputPrefix));
    return fallback ? path.join(outputDir, fallback) : null;
  } catch {
    return null;
  }
}

function cleanupDownloadedFiles(outputTemplate: string): void {
  const outputDir = path.dirname(outputTemplate);
  const outputPrefix = path.basename(outputTemplate).replace('.%(ext)s', '');

  try {
    const files = fs.readdirSync(outputDir).filter((entry) => entry.startsWith(outputPrefix));
    for (const file of files) {
      try {
        fs.unlinkSync(path.join(outputDir, file));
      } catch {
        // Ignore cleanup failures.
      }
    }
  } catch {
    // Ignore cleanup failures.
  }
}

async function downloadAudioWithYtDlp(
  url: string,
  outputTemplate: string,
  cookieFile: string | null
): Promise<string> {
  const runner = await getYtDlpRunner();
  const strategies = buildDownloadStrategies(outputTemplate, cookieFile);
  let lastErrorMessage = 'Unknown yt-dlp error';

  for (const strategy of strategies) {
    try {
      console.log(`[Server] yt-dlp strategy: ${strategy.label}`);
      await runner(url, strategy.flags, {
        timeout: DOWNLOAD_TIMEOUT_MS,
        windowsHide: true,
      });

      const audioFile = findDownloadedAudioFile(outputTemplate);
      if (audioFile) {
        return audioFile;
      }

      lastErrorMessage = 'yt-dlp completed without producing an audio file';
      cleanupDownloadedFiles(outputTemplate);
    } catch (error) {
      lastErrorMessage = getErrorText(error);
      console.warn(
        `[Server] yt-dlp failed for strategy: ${strategy.label} | ${getErrorSnippet(lastErrorMessage)}`
      );
      cleanupDownloadedFiles(outputTemplate);
    }
  }

  throw toApiErrorFromYtDlp(lastErrorMessage);
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof SyntaxError) {
    return new ApiError('Invalid request payload.', 400, 'INVALID_REQUEST');
  }

  if (error instanceof Error) {
    return toApiErrorFromYtDlp(getErrorText(error));
  }

  return new ApiError(
    'Unable to process this video right now. Please try again later.',
    500,
    'UNKNOWN_ERROR'
  );
}

export async function POST(request: NextRequest) {
  let outputTemplate: string | null = null;
  let cookieFile: string | null = null;
  let shouldCleanupCookieFile = false;
  let audioFile: string | null = null;

  try {
    const body = await request.json();
    console.log(`[Server] YouTube extraction pipeline: ${EXTRACTION_PIPELINE_VERSION}`);
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    const shouldDownloadAudio = Boolean(body?.downloadAudio);
    const includeStreamCandidates = Boolean(body?.includeStreamCandidates);
    const clientFallbackReason = typeof body?.clientFallbackReason === 'string'
      ? body.clientFallbackReason.trim()
      : '';

    if (clientFallbackReason) {
      console.log(`[Server] Client requested server fallback: ${clientFallbackReason}`);
    }

    if (!rawUrl) {
      throw new ApiError('URL is required', 400, 'URL_REQUIRED');
    }

    const videoId = extractVideoId(rawUrl);
    if (!videoId) {
      throw new ApiError(
        'Invalid YouTube URL. Please use a valid YouTube link.',
        400,
        'INVALID_URL'
      );
    }

    const normalizedUrl = rawUrl.startsWith('http')
      ? rawUrl
      : `https://www.youtube.com/watch?v=${videoId}`;

    const oembed = await getOEmbedInfo(normalizedUrl);
    const videoInfo: VideoInfo = {
      title: oembed?.title || 'YouTube Video',
      author: oembed?.author || 'Unknown',
      lengthSeconds: 0,
      audioUrl: '',
      videoId,
      thumbnail: getThumbnailUrl(videoId, 'hq'),
    };

    if (!shouldDownloadAudio) {
      let clientStreamCandidates: StreamCandidate[] = [];
      let clientStreamStatus: 'ready' | 'unavailable' = 'unavailable';
      let clientStreamErrorCode: string | null = null;

      if (includeStreamCandidates) {
        const tempDir = getWritableTempDir();
        const cookieConfig = createCookiesFile(tempDir);
        cookieFile = cookieConfig.cookieFile;
        shouldCleanupCookieFile = cookieConfig.shouldCleanup;

        try {
          clientStreamCandidates = await getClientStreamCandidates(videoId, normalizedUrl, cookieFile);
          clientStreamStatus = clientStreamCandidates.length > 0 ? 'ready' : 'unavailable';
        } catch (candidateError) {
          const candidateApiError = toApiError(candidateError);
          clientStreamErrorCode = candidateApiError.code;
          console.warn(
            `[Server] Browser candidate generation failed (${candidateApiError.code}): ${candidateApiError.message}`
          );
        }
      }

      return NextResponse.json({
        ...videoInfo,
        clientStreamCandidates,
        clientStreamStatus,
        clientStreamErrorCode,
      });
    }

    const tempDir = getWritableTempDir();
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    outputTemplate = path.join(tempDir, `${videoId}_${uniqueSuffix}.%(ext)s`);

    const cookieConfig = createCookiesFile(tempDir);
    cookieFile = cookieConfig.cookieFile;
    shouldCleanupCookieFile = cookieConfig.shouldCleanup;

    audioFile = await downloadWithYouTubeiDirect(videoId, normalizedUrl, outputTemplate);

    if (!audioFile) {
      audioFile = await downloadAudioWithYtDlp(normalizedUrl, outputTemplate, cookieFile);
    }

    if (!fs.existsSync(audioFile)) {
      throw new ApiError(
        'Unable to download audio for this video.',
        500,
        'AUDIO_NOT_FOUND'
      );
    }

    const audioBuffer = fs.readFileSync(audioFile);
    if (audioBuffer.length > MAX_AUDIO_SIZE_BYTES) {
      throw new ApiError(
        'Video is too long. Please use videos under 30 minutes.',
        400,
        'VIDEO_TOO_LARGE'
      );
    }

    const ext = path.extname(audioFile).toLowerCase();
    const contentTypes: Record<string, string> = {
      '.mp3': 'audio/mpeg',
      '.m4a': 'audio/mp4',
      '.mp4': 'video/mp4',
      '.webm': 'audio/webm',
      '.opus': 'audio/opus',
    };

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        'Content-Type': contentTypes[ext] || 'audio/webm',
        'Content-Length': audioBuffer.length.toString(),
        'X-Video-Title': encodeURIComponent(videoInfo.title),
        'X-Video-Author': encodeURIComponent(videoInfo.author),
        'X-Video-Id': videoInfo.videoId,
        'X-Video-Thumbnail': videoInfo.thumbnail,
        'X-Video-Length': videoInfo.lengthSeconds.toString(),
      },
    });
  } catch (error) {
    const apiError = toApiError(error);
    console.error(`[Server] YouTube extraction failed (${apiError.code})`);
    if (!(error instanceof ApiError)) {
      console.error(error);
    }

    return NextResponse.json(
      { error: apiError.message, code: apiError.code },
      { status: apiError.status }
    );
  } finally {
    if (audioFile && fs.existsSync(audioFile)) {
      try {
        fs.unlinkSync(audioFile);
      } catch {
        // Ignore cleanup failures.
      }
    }

    if (outputTemplate) {
      cleanupDownloadedFiles(outputTemplate);
    }

    if (shouldCleanupCookieFile && cookieFile && fs.existsSync(cookieFile)) {
      try {
        fs.unlinkSync(cookieFile);
      } catch {
        // Ignore cleanup failures.
      }
    }
  }
}
