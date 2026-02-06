-- Migration: Add free_conversions_used column to user_profiles
-- Run this if you already have the user_profiles table

-- Add the column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles' 
        AND column_name = 'free_conversions_used'
    ) THEN
        ALTER TABLE public.user_profiles 
        ADD COLUMN free_conversions_used INTEGER DEFAULT 0;
    END IF;
END $$;

-- Update existing users to have 0 free conversions used
UPDATE public.user_profiles 
SET free_conversions_used = 0 
WHERE free_conversions_used IS NULL;
