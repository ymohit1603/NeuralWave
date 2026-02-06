import posthog from 'posthog-js';

// Initialize PostHog
export function initPostHog() {
  if (typeof window === 'undefined') return;

  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

  if (!posthogKey) {
    console.warn('[PostHog] No API key found. Set NEXT_PUBLIC_POSTHOG_KEY in your environment.');
    return;
  }

  posthog.init(posthogKey, {
    api_host: posthogHost,
    person_profiles: 'identified_only',
    capture_pageview: false, // We'll manually track page views
    capture_pageleave: true,
    autocapture: false, // Disable autocapture for more control
    persistence: 'localStorage',
    loaded: () => {
      if (process.env.NODE_ENV === 'development') {
        // Optionally disable in development
        // posthog.opt_out_capturing();
        console.log('[PostHog] Initialized in development mode');
      }
    },
  });
}

// Check if PostHog is available
function isPostHogAvailable(): boolean {
  return typeof window !== 'undefined' && typeof posthog !== 'undefined' && posthog.__loaded;
}

// PostHog event tracking
export const posthogEvents = {
  // Page views
  homeViewed: () => {
    if (!isPostHogAvailable()) return;
    posthog.capture('home_viewed', {
      url: window.location.href,
      referrer: document.referrer,
    });
  },

  homeBounced: (timeOnPage: number) => {
    if (!isPostHogAvailable()) return;
    posthog.capture('home_bounced', {
      time_on_page_seconds: timeOnPage,
      url: window.location.href,
    });
  },

  dashboardViewed: () => {
    if (!isPostHogAvailable()) return;
    posthog.capture('dashboard_viewed', {
      url: window.location.href,
    });
  },

  // Service usage
  serviceUsed: (serviceType: 'youtube' | 'upload' | 'search', details?: Record<string, any>) => {
    if (!isPostHogAvailable()) return;
    posthog.capture('service_used', {
      service_type: serviceType,
      ...details,
    });
  },

  // Paywall events
  paywallOpened: (trigger: string, mode?: string) => {
    if (!isPostHogAvailable()) return;
    posthog.capture('paywall_opened', {
      trigger,
      mode,
      url: window.location.href,
    });
  },

  paywallExited: (trigger: string, selectedPlan?: string, timeSpent?: number) => {
    if (!isPostHogAvailable()) return;
    posthog.capture('paywall_exited', {
      trigger,
      selected_plan: selectedPlan,
      time_spent_seconds: timeSpent,
      converted: false,
    });
  },

  // Purchase events
  purchaseCompleted: (plan: string, amount: number, paymentId?: string) => {
    if (!isPostHogAvailable()) return;
    posthog.capture('purchase_completed', {
      plan,
      amount,
      payment_id: paymentId,
      currency: 'USD',
    });
  },

  // Additional useful events
  conversionStarted: (source: 'youtube' | 'upload' | 'search') => {
    if (!isPostHogAvailable()) return;
    posthog.capture('conversion_started', {
      source,
    });
  },

  conversionCompleted: (source: 'youtube' | 'upload' | 'search', duration: number) => {
    if (!isPostHogAvailable()) return;
    posthog.capture('conversion_completed', {
      source,
      audio_duration_seconds: duration,
    });
  },

  downloadClicked: (isPro: boolean) => {
    if (!isPostHogAvailable()) return;
    posthog.capture('download_clicked', {
      is_pro: isPro,
    });
  },

  // User identification
  identifyUser: (userId: string, properties?: Record<string, any>) => {
    if (!isPostHogAvailable()) return;
    posthog.identify(userId, properties);
  },

  // Reset user (on logout)
  resetUser: () => {
    if (!isPostHogAvailable()) return;
    posthog.reset();
  },
};

// Export posthog instance for advanced usage
export { posthog };
