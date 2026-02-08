'use client';

import { Sidebar } from "@/components/dashboard/Sidebar";
import { Crown, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { initiateCheckout, type PlanType } from "@/lib/payments";
import { useState } from "react";
import { AuthModal } from "@/components/AuthModal";
import { useToast } from "@/hooks/use-toast";

export default function UpgradePage() {
  const { user, hasActiveSubscription, subscriptionPlan } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { toast } = useToast();

  const handleUpgrade = async (planType: PlanType) => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    try {
      await initiateCheckout(planType, user.id);
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Checkout failed',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const plans = [
    {
      id: 'weekly' as PlanType,
      name: "Weekly Pro",
      price: "$7.99",
      period: "per week",
      features: [
        "Unlimited 8D conversions",
        "Full-length audio playback",
        "High-quality WAV downloads",
        "Advanced beat detection",
        "Priority processing speed"
      ],
      current: hasActiveSubscription && subscriptionPlan === 'weekly',
      canUpgrade: false // Can't upgrade from weekly to weekly
    },
    {
      id: 'yearly' as PlanType,
      name: "Yearly Pro",
      price: "$39.99",
      period: "per year",
      savings: "Save 90%",
      features: [
        "All Weekly Pro features",
        "Save $375 per year",
        "Beat-synced panning",
        "Spatial depth effects",
        "Bass boost (6dB)",
        "Priority support"
      ],
      popular: true,
      current: hasActiveSubscription && subscriptionPlan === 'yearly',
      canUpgrade: subscriptionPlan === 'weekly' // Can upgrade from weekly to yearly
    },
    {
      id: 'lifetime' as PlanType,
      name: "Lifetime Access",
      price: "$199.99",
      period: "one-time payment",
      savings: "Best Value",
      features: [
        "All Pro features forever",
        "Lifetime updates",
        "VIP support",
        "Commercial license",
        "Early beta access",
        "Priority feature requests"
      ],
      current: hasActiveSubscription && subscriptionPlan === 'lifetime',
      canUpgrade: subscriptionPlan === 'weekly' || subscriptionPlan === 'yearly' // Can upgrade from any plan to lifetime
    }
  ];

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      
      <main className="flex-1 overflow-auto">
        {/* Mobile Menu Bar */}
        <div className="lg:hidden sticky top-0 z-20 glass-card border-b border-primary/10 h-14" />

        {/* Header */}
        <header className="glass-card border-b border-primary/10 lg:sticky lg:top-0 lg:z-10">
          <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold">Upgrade to Pro</h1>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Unlock unlimited neural-optimized audio
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Main content */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex p-3 sm:p-4 rounded-2xl bg-gradient-to-br from-primary to-accent mb-3 sm:mb-4">
              <Crown className="w-8 h-8 sm:w-12 sm:h-12 text-white" />
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-2 sm:mb-3">
              {hasActiveSubscription ? 'Upgrade Your Plan' : 'Supercharge Your Brain with Pro'}
            </h2>
            <p className="text-sm sm:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              {hasActiveSubscription 
                ? `You're currently on the ${subscriptionPlan} plan. Upgrade to unlock even more features!`
                : 'Get unlimited access to neural-optimized audio, advanced features, and priority support'
              }
            </p>
          </div>

          {/* Pricing Plans */}
          <div className="grid md:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative p-4 sm:p-6 rounded-2xl border transition-all ${
                  plan.popular
                    ? 'glass-card border-primary shadow-lg shadow-primary/20 md:scale-105'
                    : 'glass-card border-primary/20 hover:border-primary/40'
                }`}
              >
                {/* 90% OFF Badge for Yearly Plan */}
                {plan.id === 'yearly' && (
                  <div className="absolute -top-3 -right-3 px-3 py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white text-sm font-black shadow-lg animate-pulse-glow z-20">
                    90% OFF
                  </div>
                )}
                
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-accent">
                    Most Popular
                  </Badge>
                )}
                
                {plan.savings && !plan.popular && plan.id !== 'yearly' && (
                  <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground">
                    {plan.savings}
                  </Badge>
                )}

                {plan.current && (
                  <Badge variant="secondary" className="absolute -top-3 left-1/2 -translate-x-1/2">
                    Current Plan
                  </Badge>
                )}

                {plan.canUpgrade && !plan.current && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-500 to-emerald-500">
                    Upgrade Available
                  </Badge>
                )}

                <div className="text-center mb-4 sm:mb-6">
                  <h3 className="text-lg sm:text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1 mb-1">
                    <span className="text-3xl sm:text-4xl font-bold">{plan.price}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">{plan.period}</p>
                </div>

                <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2">
                      <Check className="w-4 h-4 sm:w-5 sm:h-5 text-accent flex-shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  variant={plan.popular ? "neural" : plan.current ? "outline" : "default"}
                  className="w-full gap-2"
                  disabled={plan.current && !plan.canUpgrade}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {plan.current ? (
                    "Current Plan"
                  ) : plan.canUpgrade ? (
                    <>
                      <Zap className="w-4 h-4" />
                      Upgrade to {plan.name}
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      {plan.popular ? "Upgrade Now" : "Get Started"}
                    </>
                  )}
                </Button>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div className="mt-8 sm:mt-12 p-4 sm:p-6 rounded-2xl glass-card border border-primary/20">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-center">
              {hasActiveSubscription ? 'Upgrade Information' : 'Why Upgrade?'}
            </h3>
            <div className="grid md:grid-cols-2 gap-4 sm:gap-6 text-xs sm:text-sm text-muted-foreground">
              {hasActiveSubscription ? (
                <>
                  <div>
                    <p className="mb-2">
                      <strong className="text-foreground">Upgrading Your Plan:</strong> When you upgrade, your new plan takes effect immediately and your current subscription will be updated.
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong className="text-foreground">Lifetime Access:</strong> Upgrade to lifetime for one-time payment and never worry about renewals again. Perfect for long-term users!
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="mb-2">
                      <strong className="text-foreground">Free Plan:</strong> Perfect for trying out neural optimization with 20-second previews.
                    </p>
                  </div>
                  <div>
                    <p>
                      <strong className="text-foreground">Pro Plans:</strong> Unlock full-length audio, unlimited downloads, and advanced features for serious users.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode="signup"
        title="Sign up to upgrade"
        description="Create an account to access premium features"
      />
    </div>
  );
}
