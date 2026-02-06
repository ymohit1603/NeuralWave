'use client';

import { Brain } from 'lucide-react';

interface ProcessingOverlayProps {
  isVisible: boolean;
  progress: number;
  stage: string;
  title?: string;
  thumbnail?: string;
}

export function ProcessingOverlay({
  isVisible,
  progress,
  stage,
  title,
  thumbnail,
}: ProcessingOverlayProps) {
  const clampedProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const roundedProgress = Number.isInteger(clampedProgress)
    ? clampedProgress.toString()
    : clampedProgress.toFixed(1);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl" />

      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="p-8 rounded-3xl glass-card border border-primary/20 shadow-2xl">
          {thumbnail && (
            <div className="mb-6 relative">
              <img
                src={thumbnail}
                alt={title || 'Video thumbnail'}
                className="w-full h-40 object-cover rounded-xl opacity-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent rounded-xl" />
            </div>
          )}

          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  className="text-primary/20"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="url(#gradient)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${clampedProgress * 2.83} 283`}
                  className="transition-all duration-200"
                />
                <defs>
                  <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" />
                    <stop offset="100%" stopColor="hsl(var(--accent))" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-accent animate-pulse">
                  <Brain className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          </div>

          {title && (
            <h3 className="text-center font-semibold text-lg mb-2 line-clamp-2">
              {title}
            </h3>
          )}

          <p className="text-center text-muted-foreground mb-4">
            {stage || 'Processing...'}
          </p>

          <div className="relative h-3 bg-secondary/50 rounded-full overflow-hidden mb-3">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-200 ease-out"
              style={{ width: `${clampedProgress}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full animate-shimmer"
              style={{ width: `${clampedProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Processing</span>
            <span className="font-bold text-primary">{roundedProgress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
