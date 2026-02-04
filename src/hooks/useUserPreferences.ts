import { useState, useEffect } from 'react';

export interface UserPreferences {
  goal: string | null;
  hasADHD: string | null;
  intensity: string | null;
  hasCompletedQuiz: boolean;
  conversions: number;
  email: string | null;
  name: string | null;
  hasOnboarded: boolean;
  firstConversionDate: string | null;
  lastVisit: string | null;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  goal: null,
  hasADHD: null,
  intensity: null,
  hasCompletedQuiz: false,
  conversions: 0,
  email: null,
  name: null,
  hasOnboarded: false,
  firstConversionDate: null,
  lastVisit: null,
};

export function useUserPreferences() {
  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES;
    const stored = localStorage.getItem('neuralwave-preferences');
    const parsed = stored ? JSON.parse(stored) : DEFAULT_PREFERENCES;
    
    // Update last visit
    const updated = { ...parsed, lastVisit: new Date().toISOString() };
    localStorage.setItem('neuralwave-preferences', JSON.stringify(updated));
    
    return updated;
  });

  useEffect(() => {
    localStorage.setItem('neuralwave-preferences', JSON.stringify(preferences));
  }, [preferences]);

  const updatePreferences = (updates: Partial<UserPreferences>) => {
    setPreferences(prev => ({ ...prev, ...updates }));
  };

  const incrementConversions = () => {
    setPreferences(prev => {
      const firstConversionDate = prev.conversions === 0 ? new Date().toISOString() : prev.firstConversionDate;
      return { 
        ...prev, 
        conversions: prev.conversions + 1,
        firstConversionDate
      };
    });
  };

  const resetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
  };

  const getGreeting = (): string => {
    if (preferences.name) {
      return `Welcome back, ${preferences.name}!`;
    }
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning!';
    if (hour < 18) return 'Good afternoon!';
    return 'Good evening!';
  };

  return {
    preferences,
    updatePreferences,
    incrementConversions,
    resetPreferences,
    shouldShowPaywall: preferences.conversions >= 3,
    shouldShowQuiz: !preferences.hasCompletedQuiz,
    shouldShowOnboarding: !preferences.hasOnboarded,
    isFirstVisit: !preferences.lastVisit || preferences.conversions === 0,
    getGreeting,
  };
}
