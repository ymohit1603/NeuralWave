'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createSubscription, type PlanType } from '@/lib/payments';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2 } from 'lucide-react';

function PaymentSuccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, checkSubscription } = useAuth();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processPayment = async () => {
      if (!user) {
        router.push('/dashboard');
        return;
      }

      const plan = searchParams.get('plan') as PlanType;
      const paymentId = searchParams.get('payment_id');

      if (!plan) {
        setError('Invalid payment information');
        setProcessing(false);
        return;
      }

      try {
        // Create subscription in database
        await createSubscription(user.id, plan, paymentId || undefined);

        // Refresh subscription status
        await checkSubscription();

        setProcessing(false);

        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push('/dashboard');
        }, 3000);
      } catch (err) {
        console.error('Error processing payment:', err);
        setError('Failed to activate subscription. Please contact support.');
        setProcessing(false);
      }
    };

    processPayment();
  }, [user, searchParams, router, checkSubscription]);

  if (processing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-16 h-16 animate-spin text-foreground mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Processing your payment...</h1>
          <p className="text-muted-foreground">Please wait while we activate your subscription</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Payment Error</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => router.push('/dashboard/upgrade')}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <CheckCircle className="w-16 h-16 text-foreground mx-auto mb-4" />
        <h1 className="text-3xl font-bold mb-2">🎉 Welcome to Pro!</h1>
        <p className="text-lg text-muted-foreground mb-6">
          Your subscription has been activated successfully. You now have access to all premium features!
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          Redirecting to dashboard...
        </p>
        <Button variant="neural" onClick={() => router.push('/dashboard')}>
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="w-16 h-16 animate-spin text-foreground mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Loading...</h1>
      </div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentSuccessContent />
    </Suspense>
  );
}
