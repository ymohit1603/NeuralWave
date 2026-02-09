'use client';

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

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="p-8 rounded-2xl bg-white border border-border shadow-lg">
          {thumbnail && (
            <div className="mb-6 relative">
              <img
                src={thumbnail}
                alt={title || 'Video thumbnail'}
                className="w-full h-40 object-cover rounded-xl"
              />
            </div>
          )}

          <div className="flex justify-center mb-6">
            <div className="relative">
              <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-secondary"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={`${clampedProgress * 2.83} 283`}
                  className="text-foreground transition-all duration-200"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-semibold">{roundedProgress}%</span>
              </div>
            </div>
          </div>

          {title && (
            <h3 className="text-center font-medium text-sm mb-2 line-clamp-2">
              {title}
            </h3>
          )}

          <p className="text-center text-sm text-muted-foreground">
            {stage || 'Processing...'}
          </p>
        </div>
      </div>
    </div>
  );
}
