'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { Brain, Loader2, Mail, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  mode?: 'signup' | 'login';
  title?: string;
  description?: string;
}

export function AuthModal({
  open,
  onClose,
  mode: initialMode = 'signup',
  title,
  description
}: AuthModalProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<'google' | 'email' | null>(null);
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setProvider('google');
      setError(null);
      await signInWithGoogle();
    } catch (err: any) {
      console.error('Google sign in error:', err);
      setError(err.message || 'Failed to sign in with Google. Please try again.');
      setLoading(false);
      setProvider(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setProvider('email');

    let result: { success: boolean; error?: string };

    if (mode === 'signup') {
      result = await signUpWithEmail(email, password);
    } else {
      result = await signInWithEmail(email, password);
    }

    if (result.success) {
      onClose();
    } else {
      setError(result.error || 'Authentication failed. Please try again.');
      setLoading(false);
      setProvider(null);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'signup' ? 'login' : 'signup');
    setShowEmailForm(false);
    setEmail('');
    setPassword('');
    setError(null);
  };

  const handleClose = () => {
    setError(null);
    setShowEmailForm(false);
    setEmail('');
    setPassword('');
    onClose();
  };

  const defaultTitle = mode === 'signup'
    ? 'Create Your Account'
    : 'Welcome Back';

  const defaultDescription = mode === 'signup'
    ? 'Sign up to save your tracks and unlock premium features'
    : 'Sign in to access your saved tracks and settings';



  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md" hideCloseButton ariaTitle={title || defaultTitle}>
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-2xl bg-primary">
              <Brain className="w-8 h-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-center text-2xl">
            {title || defaultTitle}
          </DialogTitle>
          <DialogDescription className="text-center">
            {description || defaultDescription}
          </DialogDescription>
        </DialogHeader>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!showEmailForm ? (
          <div className="space-y-3 mt-4">
            {/* Google Sign In */}
            <Button
              variant="outline"
              size="lg"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full gap-3 h-12 text-base font-medium"
            >
              {loading && provider === 'google' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or
                </span>
              </div>
            </div>

            {/* Email/Password Sign In */}
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                setShowEmailForm(true);
                setError(null);
              }}
              disabled={loading}
              className="w-full gap-3 h-12 text-base font-medium"
            >
              <Mail className="w-5 h-5" />
              Continue with Email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleEmailAuth} className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
                minLength={6}
              />
              {mode === 'signup' && (
                <p className="text-xs text-muted-foreground">Must be at least 6 characters</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowEmailForm(false);
                  setError(null);
                }}
                disabled={loading}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="flex-1 gap-2"
              >
                {loading && provider === 'email' && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {mode === 'signup' ? 'Sign Up' : 'Sign In'}
              </Button>
            </div>
          </form>
        )}

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              onClick={toggleMode}
              className="text-foreground hover:underline font-medium"
              disabled={loading}
            >
              {mode === 'signup' ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
