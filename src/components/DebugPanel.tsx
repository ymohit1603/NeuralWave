import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Trash2 } from 'lucide-react';
import { analytics } from '@/lib/analytics';
import { performanceMonitor } from '@/lib/performance';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { getSubscription } from '@/lib/subscriptionManager';

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'state' | 'events' | 'performance'>('state');
  const { preferences } = useUserPreferences();
  const subscription = getSubscription();

  useEffect(() => {
    // Check for debug mode
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === 'true' || 
                      localStorage.getItem('debug_mode') === 'true';
    
    if (debugMode) {
      setIsOpen(true);
    }

    // Keyboard shortcut: Ctrl+Shift+D
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        setIsOpen(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  const handleDownloadState = () => {
    const state = {
      preferences,
      subscription,
      localStorage: { ...localStorage },
      events: analytics.getEvents(),
      performance: performanceMonitor.getMetrics(),
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `neuralwave-debug-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearEvents = () => {
    analytics.clearEvents();
    performanceMonitor.clearMetrics();
  };

  const handleClearStorage = () => {
    if (confirm('Clear all localStorage data? This will reset the app.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-[600px] z-50 glass-card border border-primary/20 rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50 bg-secondary/50">
        <h3 className="font-semibold text-sm">Debug Panel</h3>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDownloadState}
            className="h-8 w-8"
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsOpen(false)}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/50">
        {['state', 'events', 'performance'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
              activeTab === tab
                ? 'bg-primary/10 text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 overflow-auto max-h-[400px] text-xs font-mono">
        {activeTab === 'state' && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-foreground">User Preferences</h4>
              <pre className="bg-secondary/50 p-2 rounded overflow-auto">
                {JSON.stringify(preferences, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-foreground">Subscription</h4>
              <pre className="bg-secondary/50 p-2 rounded overflow-auto">
                {JSON.stringify(subscription, null, 2)}
              </pre>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearStorage}
              className="w-full gap-2"
            >
              <Trash2 className="w-3 h-3" />
              Clear All Data
            </Button>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-foreground">
                Analytics Events ({analytics.getEvents().length})
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearEvents}
                className="h-6 px-2"
              >
                Clear
              </Button>
            </div>
            {analytics.getEvents().length === 0 ? (
              <p className="text-muted-foreground">No events tracked yet</p>
            ) : (
              <div className="space-y-2">
                {analytics.getEvents().slice(-10).reverse().map((event, i) => (
                  <div key={i} className="bg-secondary/50 p-2 rounded">
                    <div className="font-semibold text-accent">{event.name}</div>
                    <div className="text-muted-foreground text-[10px]">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                    {Object.keys(event.properties || {}).length > 0 && (
                      <pre className="mt-1 text-[10px] text-muted-foreground">
                        {JSON.stringify(event.properties, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'performance' && (
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2 text-foreground">Memory Usage</h4>
              {performanceMonitor.getMemoryUsage() ? (
                <div className="bg-secondary/50 p-2 rounded">
                  <div>Used: {performanceMonitor.getMemoryUsage()!.used}MB</div>
                  <div>Total: {performanceMonitor.getMemoryUsage()!.total}MB</div>
                  <div>Percentage: {performanceMonitor.getMemoryUsage()!.percentage}%</div>
                </div>
              ) : (
                <p className="text-muted-foreground">Memory API not available</p>
              )}
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-foreground">
                Performance Metrics ({performanceMonitor.getMetrics().length})
              </h4>
              {performanceMonitor.getMetrics().length === 0 ? (
                <p className="text-muted-foreground">No metrics recorded yet</p>
              ) : (
                <div className="space-y-2">
                  {performanceMonitor.getMetrics().slice(-10).reverse().map((metric, i) => (
                    <div key={i} className="bg-secondary/50 p-2 rounded">
                      <div className="font-semibold">{metric.label}</div>
                      <div className="text-accent">{metric.duration.toFixed(2)}ms</div>
                      <div className="text-muted-foreground text-[10px]">
                        {new Date(metric.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-border/50 bg-secondary/50 text-center text-[10px] text-muted-foreground">
        Press Ctrl+Shift+D to toggle • ?debug=true in URL
      </div>
    </div>
  );
}
