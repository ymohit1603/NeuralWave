'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  hasActiveSubscription: boolean;
  subscriptionPlan: 'free' | 'weekly' | 'monthly' | 'yearly' | 'lifetime';
  freeConversionsUsed: number;
  canConvert: boolean;
  incrementFreeConversion: () => Promise<void>;
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

  const incrementFreeConversion = async () => {
    // Free conversion is account-scoped; guest previews should not consume it.
    if (hasActiveSubscription || !user) {
      return;
    }

    const newCount = freeConversionsUsed + 1;
    setFreeConversionsUsed(newCount);

    // Store in database for signed-in users
    try {
      const { error } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: user.id,
          email: user.email,
          free_conversions_used: newCount,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Error updating free conversions:', error);
        // Fallback to localStorage
        localStorage.setItem(`free_conversions_${user.id}`, newCount.toString());
      }
    } catch (error) {
      console.error('Error updating free conversions:', error);
      // Fallback to localStorage
      localStorage.setItem(`free_conversions_${user.id}`, newCount.toString());
    }
  };

  const checkSubscription = async () => {
    if (!user) {
      // Guest user previews are always allowed, but do not consume account conversions.
      localStorage.removeItem('free_conversions_guest');
      setFreeConversionsUsed(0);
      setHasActiveSubscription(false);
      setSubscriptionPlan('free');
      return;
    }

    // Signed-in user - load from database first, fallback to localStorage
    try {
      // Check for free conversions in database
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('free_conversions_used')
        .eq('user_id', user.id)
        .single();

      if (!profileError && profileData) {
        setFreeConversionsUsed(profileData.free_conversions_used || 0);
      } else {
        // No profile yet - fallback to user-specific local cache only.
        const userConversions = localStorage.getItem(`free_conversions_${user.id}`);

        let conversionsUsed = 0;
        if (userConversions) {
          const parsed = parseInt(userConversions, 10);
          conversionsUsed = Number.isFinite(parsed) ? parsed : 0;
        }

        setFreeConversionsUsed(conversionsUsed);

        // Create profile in database
        await supabase
          .from('user_profiles')
          .upsert({
            user_id: user.id,
            email: user.email,
            free_conversions_used: conversionsUsed,
          }, {
            onConflict: 'user_id'
          });
      }
    } catch (error) {
      console.error('Error loading free conversions:', error);
      // Fallback to localStorage
      const userConversions = localStorage.getItem(`free_conversions_${user.id}`);

      if (userConversions) {
        const parsed = parseInt(userConversions, 10);
        setFreeConversionsUsed(Number.isFinite(parsed) ? parsed : 0);
      } else {
        setFreeConversionsUsed(0);
      }
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

  const signInWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      const message = error.message.toLowerCase();

      // "Invalid login credentials" can mean either wrong password OR no account
      // Try to create account - if it fails with "already exists", then password was wrong
      if (message.includes('invalid login credentials') || message.includes('user not found')) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { email_confirmed: true },
          },
        });

        if (signUpError) {
          const signUpMsg = signUpError.message.toLowerCase();
          // Account exists - so the original error was wrong password
          if (signUpMsg.includes('already registered') || signUpMsg.includes('already exists') || signUpMsg.includes('user already')) {
            const errMsg = 'Wrong password. Please try again.';
            setAuthError(errMsg);
            return { success: false, error: errMsg };
          }
          const errMsg = getAuthErrorMessage(signUpError);
          setAuthError(errMsg);
          return { success: false, error: errMsg };
        }

        // Account created successfully
        if (signUpData.user && !signUpData.session) {
          // Need to sign in after signup (email confirmation enabled in Supabase)
          const { error: retryError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (retryError) {
            const errMsg = 'Account created! Please sign in.';
            setAuthError(errMsg);
            return { success: false, error: errMsg };
          }
        }
        return { success: true }; // Account created and signed in
      }

      const errMsg = getAuthErrorMessage(error);
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    }

    return { success: true };
  };

  const signUpWithEmail = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    setAuthError(null);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { email_confirmed: true },
      },
    });

    if (error) {
      const message = error.message.toLowerCase();

      // Account already exists - try to sign in with provided password
      if (message.includes('already registered') || message.includes('already exists') || message.includes('user already')) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          // Password doesn't match existing account
          const errMsg = 'Wrong password. Please try again.';
          setAuthError(errMsg);
          return { success: false, error: errMsg };
        }

        return { success: true }; // Signed in to existing account
      }

      const errMsg = getAuthErrorMessage(error);
      setAuthError(errMsg);
      return { success: false, error: errMsg };
    }

    // If signup succeeded but no session, try signing in
    if (data.user && !data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) {
        const errMsg = 'Account created! Please sign in.';
        setAuthError(errMsg);
        return { success: false, error: errMsg };
      }
    }

    return { success: true };
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
