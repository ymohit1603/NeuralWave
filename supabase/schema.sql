-- NeuralWave Database Schema for Supabase
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- SUBSCRIPTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_type VARCHAR(20) NOT NULL CHECK (plan_type IN ('weekly', 'monthly', 'yearly', 'lifetime')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'refunded')),
    dodo_payment_id VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_dodo_payment_id ON public.subscriptions(dodo_payment_id);

-- ============================================
-- USER PROFILES TABLE (optional, for additional user data)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url TEXT,
    free_conversions_used INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON public.user_profiles(user_id);

-- ============================================
-- PENDING PAYMENTS TABLE (for webhook reconciliation)
-- ============================================
CREATE TABLE IF NOT EXISTS public.pending_payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_id VARCHAR(255) NOT NULL UNIQUE,
    product_id VARCHAR(255),
    customer_email VARCHAR(255),
    plan_type VARCHAR(20) CHECK (plan_type IN ('weekly', 'monthly', 'yearly', 'lifetime')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_pending_payments_payment_id ON public.pending_payments(payment_id);
CREATE INDEX IF NOT EXISTS idx_pending_payments_customer_email ON public.pending_payments(customer_email);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_payments ENABLE ROW LEVEL SECURITY;

-- Subscriptions: Users can only read their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions
    FOR SELECT USING (auth.uid() = user_id);

-- Subscriptions: Only service role can insert/update (via webhooks)
CREATE POLICY "Service role can manage subscriptions" ON public.subscriptions
    FOR ALL USING (auth.role() = 'service_role');

-- User Profiles: Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON public.user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Pending Payments: Only service role can access
CREATE POLICY "Service role can manage pending payments" ON public.pending_payments
    FOR ALL USING (auth.role() = 'service_role');

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check if a user has an active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_has_subscription BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.subscriptions
        WHERE user_id = p_user_id
        AND status = 'active'
        AND (expires_at IS NULL OR expires_at > NOW())
    ) INTO v_has_subscription;

    RETURN v_has_subscription;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's current subscription
CREATE OR REPLACE FUNCTION public.get_user_subscription(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    plan_type VARCHAR(20),
    status VARCHAR(20),
    started_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.plan_type,
        s.status,
        s.started_at,
        s.expires_at
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
    AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > NOW())
    ORDER BY s.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- SAMPLE DATA (for testing - remove in production)
-- ============================================
-- Uncomment below to insert test data
/*
INSERT INTO public.subscriptions (user_id, plan_type, status, started_at, expires_at)
VALUES
    ('your-test-user-uuid', 'yearly', 'active', NOW(), NOW() + INTERVAL '1 year');
*/

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant select on subscriptions to authenticated users (RLS will filter)
GRANT SELECT ON public.subscriptions TO authenticated;

-- Grant all on user_profiles to authenticated users (RLS will filter)
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_subscription(UUID) TO authenticated;
