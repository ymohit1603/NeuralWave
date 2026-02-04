/**
 * Analytics Tracking System
 * Supports Google Analytics, Mixpanel, or custom analytics
 */

export interface AnalyticsEvent {
  name: string;
  properties?: Record<string, any>;
  timestamp: string;
  userAgent: string;
  isPro: boolean;
  conversionCount: number;
  variant?: string;
}

export interface UserProperties {
  goal?: string;
  intensity?: string;
  hasADHD?: string;
  isPro: boolean;
  conversionCount: number;
  email?: string;
}

class Analytics {
  private isDebugMode: boolean;
  private events: AnalyticsEvent[] = [];

  constructor() {
    // Check for debug mode via URL param (only on client-side)
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      this.isDebugMode = urlParams.get('debug') === 'true' || 
                         localStorage.getItem('debug_mode') === 'true';
    } else {
      this.isDebugMode = false;
    }
  }

  /**
   * Track an event
   */
  track(eventName: string, properties: Record<string, any> = {}): void {
    // Skip on server-side
    if (typeof window === 'undefined') return;

    const event: AnalyticsEvent = {
      name: eventName,
      properties,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      isPro: this.getIsPro(),
      conversionCount: this.getConversionCount(),
      variant: this.getABTestVariant(),
    };

    // Store event
    this.events.push(event);

    // Console log in debug mode
    if (this.isDebugMode) {
      console.log('[Analytics]', event);
    }

    // Send to analytics service in production
    if (process.env.NODE_ENV === 'production' && !this.isDebugMode) {
      this.sendToAnalytics(event);
    }
  }

  /**
   * Identify user
   */
  identifyUser(email: string, properties: Partial<UserProperties> = {}): void {
    // Skip on server-side
    if (typeof window === 'undefined') return;

    const userProps: UserProperties = {
      email,
      isPro: this.getIsPro(),
      conversionCount: this.getConversionCount(),
      ...properties,
    };

    if (this.isDebugMode) {
      console.log('[Analytics] User identified:', userProps);
    }

    // Send to analytics service
    if (process.env.NODE_ENV === 'production' && !this.isDebugMode) {
      this.sendUserProperties(userProps);
    }
  }

  /**
   * Track page view
   */
  pageView(pageName: string, properties: Record<string, any> = {}): void {
    // Skip on server-side
    if (typeof window === 'undefined') return;

    this.track('page_view', {
      page: pageName,
      path: window.location.pathname,
      ...properties,
    });
  }

  /**
   * Get all tracked events (for debugging)
   */
  getEvents(): AnalyticsEvent[] {
    return this.events;
  }

  /**
   * Clear events
   */
  clearEvents(): void {
    this.events = [];
  }

  /**
   * Enable/disable debug mode
   */
  setDebugMode(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    
    this.isDebugMode = enabled;
    localStorage.setItem('debug_mode', enabled ? 'true' : 'false');
  }

  /**
   * Get debug mode status
   */
  getDebugMode(): boolean {
    return this.isDebugMode;
  }

  // Private helper methods

  private getIsPro(): boolean {
    if (typeof window === 'undefined') return false;
    
    try {
      const subscription = localStorage.getItem('neuralwave-subscription');
      if (!subscription) return false;
      const data = JSON.parse(subscription);
      return data.isSubscribed || false;
    } catch {
      return false;
    }
  }

  private getConversionCount(): number {
    if (typeof window === 'undefined') return 0;
    
    try {
      const prefs = localStorage.getItem('neuralwave-preferences');
      if (!prefs) return 0;
      const data = JSON.parse(prefs);
      return data.conversions || 0;
    } catch {
      return 0;
    }
  }

  private getABTestVariant(): string {
    if (typeof window === 'undefined') return 'A';
    return localStorage.getItem('ab_test_variant') || 'A';
  }

  private sendToAnalytics(event: AnalyticsEvent): void {
    if (typeof window === 'undefined') return;

    // Google Analytics 4
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('event', event.name, event.properties);
    }

    // Mixpanel
    if (typeof (window as any).mixpanel !== 'undefined') {
      (window as any).mixpanel.track(event.name, event.properties);
    }

    // Custom analytics endpoint
    const analyticsEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT;
    if (analyticsEndpoint) {
      fetch(analyticsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      }).catch(err => console.error('Analytics error:', err));
    }
  }

  private sendUserProperties(properties: UserProperties): void {
    if (typeof window === 'undefined') return;

    // Google Analytics 4
    if (typeof (window as any).gtag === 'function') {
      (window as any).gtag('set', 'user_properties', properties);
    }

    // Mixpanel
    if (typeof (window as any).mixpanel !== 'undefined') {
      (window as any).mixpanel.people.set(properties);
    }
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Convenience methods for common events
export const trackEvent = {
  // Page views
  landingPageView: () => analytics.pageView('landing'),
  dashboardPageView: () => analytics.pageView('dashboard'),
  settingsPageView: () => analytics.pageView('settings'),

  // Onboarding
  quizStarted: () => analytics.track('quiz_started'),
  quizCompleted: (answers: Record<string, string>) => 
    analytics.track('quiz_completed', answers),

  // Audio processing
  fileUploaded: (fileSize: number, duration: number) => 
    analytics.track('file_uploaded', { fileSize, duration }),
  processingStarted: (fileName: string) => 
    analytics.track('processing_started', { fileName }),
  processingCompleted: (duration: number, processingTime: number) => 
    analytics.track('processing_completed', { duration, processingTime }),
  
  // Conversions
  conversionCompleted: (conversionNumber: number) => 
    analytics.track('conversion_completed', { conversionNumber }),
  
  // Paywall
  paywallShown: (trigger: string) => 
    analytics.track('paywall_shown', { trigger }),
  subscriptionStarted: (plan: string) => 
    analytics.track('subscription_started', { plan }),
  subscriptionCompleted: (plan: string, amount: number) => 
    analytics.track('subscription_completed', { plan, amount }),
  
  // Email
  emailCaptured: (source: string) => 
    analytics.track('email_captured', { source }),
  
  // Downloads
  downloadClicked: (fileName: string) => 
    analytics.track('download_clicked', { fileName }),
  downloadCompleted: (fileName: string, fileSize: number) => 
    analytics.track('download_completed', { fileName, fileSize }),

  // Errors
  errorOccurred: (errorType: string, errorMessage: string) => 
    analytics.track('error_occurred', { errorType, errorMessage }),
};
