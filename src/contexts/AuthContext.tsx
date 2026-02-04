'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  hasActiveSubscription: boolean;
  subscriptionPlan: 'free' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
  freeConversionsUsed: number;
  canConvert: boolean;
  incrementFreeConversion: () => void;
  checkSubscription: () => Promise<void>;
  authError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to get user-friendly error message
function getAuthErrorMessage(error: AuthError | Error): string {
  const message = error.message.toLowerCase();

  if (message.includes('invalid api key') || message.includes('apikey')) {
    return 'Authentication service is not configured. Please contact support.';
  }
  if (message.includes('invalid login credentials') || message.includes('invalid password')) {
    return 'Invalid email or password. Please try again.';
  }
  if (message.includes('email not confirmed')) {
    return 'Please check your email and confirm your account first.';
  }
  if (message.includes('user already registered') || message.includes('already exists')) {
    return 'An account with this email already exists. Try signing in instead.';
  }
  if (message.includes('password') && message.includes('weak')) {
    return 'Password is too weak. Please use at least 6 characters.';
  }
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network error. Please check your internet connection.';
  }

  return error.message || 'An error occurred. Please try again.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [subscriptionPlan, setSubscriptionPlan] = useState<'free' | 'weekly' | 'monthly' | 'yearly' | 'lifetime'>('free');
  const [freeConversionsUsed, setFreeConversionsUsed] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  const canConvert = hasActiveSubscription || freeConversionsUsed < 1;

  const incrementFreeConversion = () => {
    if (!hasActiveSubscription && freeConversionsUsed < 1) {
      const newCount = freeConversionsUsed + 1;
      setFreeConversionsUsed(newCount);
      // Store in localStorage with or without user
      const storageKey = user ? `free_conversions_${user.id}` : 'free_conversions_guest';
      localStorage.setItem(storageKey, newCount.toString());
    }
  };

  const checkSubscription = async () => {
    // Load free conversions from localStorage (guest or user)
    const guestConversions = localStorage.getItem('free_conversions_guest');
    const userConversions = user ? localStorage.getItem(`free_conversions_${user.id}`) : null;
    
    if (userConversions) {
      setFreeConversionsUsed(parseInt(userConversions, 10));
    } else if (guestConversions && !user) {
      setFreeConversionsUsed(parseInt(guestConversions, 10));
    }

    if (!user) {
      setHasActiveSubscription(false);
      setSubscriptionPlan('free');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        setHasActiveSubscription(false);
        setSubscriptionPlan('free');
        return;
      }

      // Check if subscription is still valid
      if (data.plan_type === 'lifetime') {
        setHasActiveSubscription(true);
        setSubscriptionPlan('lifetime');
      } else if (data.expires_at) {
        const expiresAt = new Date(data.expires_at);
        const now = new Date();
        
        if (expiresAt > now) {
          setHasActiveSubscription(true);
          setSubscriptionPlan(data.plan_type);
        } else {
          // Subscription expired, update status
          await supabase
            .from('subscriptions')
            .update({ status: 'expired' })
            .eq('id', data.id);
          
          setHasActiveSubscription(false);
          setSubscriptionPlan('free');
        }
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setHasActiveSubscription(false);
      setSubscriptionPlan('free');
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    checkSubscription();
  }, [user]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      throw new Error(message);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      throw new Error(message);
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      const message = getAuthErrorMessage(error);
      setAuthError(message);
      throw new Error(message);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setHasActiveSubscription(false);
    setSubscriptionPlan('free');
    setFreeConversionsUsed(0);
  };

  const value = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    hasActiveSubscription,
    subscriptionPlan,
    freeConversionsUsed,
    canConvert,
    incrementFreeConversion,
    checkSubscription,
    authError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
