declare module 'yt-dlp-exec' {
  interface YtDlpExecOptions {
    cwd?: string;
    timeout?: number;
    windowsHide?: boolean;
    env?: NodeJS.ProcessEnv;
  }

  type YtDlpFlags = Record<string, string | number | boolean>;

  type YtDlpExec = (
    url: string,
    flags?: YtDlpFlags,
    options?: YtDlpExecOptions
  ) => Promise<unknown>;

  const ytDlp: YtDlpExec;
  export default ytDlp;
}
