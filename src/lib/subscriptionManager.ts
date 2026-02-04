/**
 * Subscription Manager
 * Handles subscription state, validation, and localStorage persistence
 */

export interface SubscriptionData {
  isSubscribed: boolean;
  plan: 'weekly' | 'yearly' | 'lifetime' | null;
  startDate: string | null;
  endDate: string | null;
  paymentId: string | null;
}

const SUBSCRIPTION_KEY = 'neuralwave-subscription';

/**
 * Get current subscription status
 */
export function getSubscription(): SubscriptionData {
  if (typeof window === 'undefined') {
    return {
      isSubscribed: false,
      plan: null,
      startDate: null,
      endDate: null,
      paymentId: null,
    };
  }

  const stored = localStorage.getItem(SUBSCRIPTION_KEY);
  if (!stored) {
    return {
      isSubscribed: false,
      plan: null,
      startDate: null,
      endDate: null,
      paymentId: null,
    };
  }

  try {
    const data: SubscriptionData = JSON.parse(stored);
    
    // Lifetime subscriptions never expire
    if (data.plan === 'lifetime') {
      return data;
    }
    
    // Check if subscription is still valid
    if (data.endDate && new Date(data.endDate) < new Date()) {
      // Subscription expired
      clearSubscription();
      return {
        isSubscribed: false,
        plan: null,
        startDate: null,
        endDate: null,
        paymentId: null,
      };
    }

    return data;
  } catch (error) {
    console.error('Error parsing subscription data:', error);
    return {
      isSubscribed: false,
      plan: null,
      startDate: null,
      endDate: null,
      paymentId: null,
    };
  }
}

/**
 * Save subscription data
 */
export function saveSubscription(plan: 'weekly' | 'yearly' | 'lifetime', paymentId: string): void {
  const startDate = new Date();
  let endDate: Date | null = null;
  
  // Calculate end date based on plan
  if (plan === 'weekly') {
    endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);
  } else if (plan === 'yearly') {
    endDate = new Date();
    endDate.setFullYear(endDate.getFullYear() + 1);
  }
  // Lifetime has no end date

  const subscriptionData: SubscriptionData = {
    isSubscribed: true,
    plan,
    startDate: startDate.toISOString(),
    endDate: endDate ? endDate.toISOString() : null,
    paymentId,
  };

  localStorage.setItem(SUBSCRIPTION_KEY, JSON.stringify(subscriptionData));
}

/**
 * Clear subscription data
 */
export function clearSubscription(): void {
  localStorage.removeItem(SUBSCRIPTION_KEY);
}

/**
 * Check if user has active subscription
 */
export function hasActiveSubscription(): boolean {
  const subscription = getSubscription();
  return subscription.isSubscribed;
}

/**
 * Get days remaining in subscription
 */
export function getDaysRemaining(): number | null {
  const subscription = getSubscription();
  
  // Lifetime subscriptions never expire
  if (subscription.plan === 'lifetime') {
    return null; // null indicates lifetime
  }
  
  if (!subscription.isSubscribed || !subscription.endDate) {
    return null;
  }

  const now = new Date();
  const end = new Date(subscription.endDate);
  const diffTime = end.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
}

/**
 * Format subscription end date
 */
export function getSubscriptionEndDate(): string | null {
  const subscription = getSubscription();
  
  if (subscription.plan === 'lifetime') {
    return 'Lifetime Access';
  }
  
  if (!subscription.endDate) return null;

  const date = new Date(subscription.endDate);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Calculate savings for yearly plan
 */
export function calculateYearlySavings(): { amount: number; percentage: number } {
  const weeklyPrice = 9.99;
  const yearlyPrice = 39.99;
  const weeklyYearlyCost = weeklyPrice * 52; // 52 weeks in a year
  const savings = weeklyYearlyCost - yearlyPrice;
  const percentage = Math.round((savings / weeklyYearlyCost) * 100);

  return {
    amount: savings,
    percentage,
  };
}

/**
 * Calculate savings for lifetime plan
 */
export function calculateLifetimeSavings(): { 
  vsWeekly: { amount: number; percentage: number };
  vsYearly: { amount: number; years: number };
} {
  const weeklyPrice = 9.99;
  const yearlyPrice = 39.99;
  const lifetimePrice = 199;
  
  // Compare to 5 years of weekly payments
  const fiveYearsWeekly = weeklyPrice * 52 * 5;
  const savingsVsWeekly = fiveYearsWeekly - lifetimePrice;
  const percentageVsWeekly = Math.round((savingsVsWeekly / fiveYearsWeekly) * 100);
  
  // How many years of yearly plan equals lifetime
  const yearsOfYearly = lifetimePrice / yearlyPrice;

  return {
    vsWeekly: {
      amount: savingsVsWeekly,
      percentage: percentageVsWeekly,
    },
    vsYearly: {
      amount: (yearlyPrice * Math.ceil(yearsOfYearly)) - lifetimePrice,
      years: Math.ceil(yearsOfYearly),
    },
  };
}
