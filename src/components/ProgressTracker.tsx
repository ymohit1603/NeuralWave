import { Check, Circle } from "lucide-react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { hasActiveSubscription } from "@/lib/subscriptionManager";

export function ProgressTracker() {
  const { preferences } = useUserPreferences();
  const isSubscribed = hasActiveSubscription();

  const milestones = [
    {
      id: 'profile',
      label: 'Profile Created',
      completed: preferences.hasCompletedQuiz,
    },
    {
      id: 'first-track',
      label: 'First Track Optimized',
      completed: preferences.conversions > 0,
    },
    {
      id: 'pro',
      label: 'Go Pro',
      completed: isSubscribed,
    },
  ];

  const completedCount = milestones.filter(m => m.completed).length;
  const progress = (completedCount / milestones.length) * 100;

  return (
    <div className="p-4 rounded-xl bg-card border border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium">Your Progress</h3>
        <span className="text-xs text-muted-foreground">
          {completedCount}/{milestones.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-secondary rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-foreground rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Milestones */}
      <div className="space-y-2.5">
        {milestones.map((milestone) => (
          <div
            key={milestone.id}
            className="flex items-center gap-3 text-sm"
          >
            <div
              className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                milestone.completed
                  ? 'bg-foreground text-background'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {milestone.completed ? (
                <Check className="w-3 h-3" />
              ) : (
                <Circle className="w-2 h-2 fill-current" />
              )}
            </div>
            <span
              className={
                milestone.completed
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }
            >
              {milestone.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
