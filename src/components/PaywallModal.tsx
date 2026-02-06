import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Brain, Sparkles, Check, Loader2 } from "lucide-react";
import { saveSubscription, calculateYearlySavings } from "@/lib/subscriptionManager";
import { useToast } from "@/hooks/use-toast";
import { posthogEvents } from "@/lib/posthog";

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  onSubscribed?: () => void;
  mode?: 'upgrade' | 'preview-limit' | 'conversion-limit';
  title?: string;
  description?: string;
}

export function PaywallModal({
  open,
  onClose,
  onSubscribed,
  mode = 'upgrade',
  title,
  description
}: PaywallModalProps) {
  const [selectedPlan, setSelectedPlan] = useState<"weekly" | "yearly" | "lifetime">("yearly");
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();
  const openTimeRef = useRef<number>(0);

  // Track paywall opened
  useEffect(() => {
    if (open) {
      openTimeRef.current = Date.now();
      posthogEvents.paywallOpened(mode, mode);
    }
  }, [open, mode]);

  const handleClose = () => {
    // Track paywall exited
    const timeSpent = Math.floor((Date.now() - openTimeRef.current) / 1000);
    posthogEvents.paywallExited(mode, selectedPlan, timeSpent);
    onClose();
  };

  const savings = calculateYearlySavings();
  const weeklyYearlyCost = 7.99 * 52;

  const plans = {
    weekly: {
      price: 7.99,
      displayPrice: "$7.99",
      period: "week",
      savings: null,
      description: "Billed weekly",
      badge: null,
    },
    yearly: {
      price: 39.99,
      displayPrice: "$39.99",
      period: "year",
      originalPrice: weeklyYearlyCost,
      displayOriginalPrice: `$${weeklyYearlyCost.toFixed(2)}`,
      savings: "Save 90%",
      savingsAmount: `Save $${savings.amount.toFixed(2)}`,
      description: "Billed annually",
      badge: "BEST VALUE",
    },
    lifetime: {
      price: 199,
      displayPrice: "$199",
      period: "lifetime",
      originalPrice: 7.99 * 52 * 5, // 5 years of weekly
      displayOriginalPrice: `$${(7.99 * 52 * 5).toFixed(2)}`,
      savings: "Save 95%",
      savingsAmount: `Save $${((7.99 * 52 * 5) - 199).toFixed(2)}`,
      description: "One-time payment",
      badge: "MOST POPULAR",
    },
  };

  const handleUpgrade = async () => {
    setIsProcessing(true);

    try {
      // Initialize DodoPayments
      const plan = plans[selectedPlan];
      
      // DodoPayments configuration
      const dodoConfig = {
        productId: selectedPlan === 'weekly' 
          ? process.env.VITE_DODO_WEEKLY_PRODUCT_ID || 'prod_weekly_neuralwave'
          : selectedPlan === 'yearly'
          ? process.env.VITE_DODO_YEARLY_PRODUCT_ID || 'prod_yearly_neuralwave'
          : process.env.VITE_DODO_LIFETIME_PRODUCT_ID || 'prod_lifetime_neuralwave',
        publicKey: process.env.VITE_DODO_PUBLIC_KEY || 'pk_test_your_key_here',
        amount: plan.price,
        currency: 'USD',
        customerEmail: '', // Can be collected from user
        successUrl: `${window.location.origin}/dashboard?payment=success`,
        cancelUrl: `${window.location.origin}/dashboard?payment=cancelled`,
      };

      // Check if DodoPayments is loaded
      if (typeof (window as any).DodoPayments === 'undefined') {
        // Fallback: Simulate successful payment for demo
        console.log('DodoPayments not loaded, simulating payment...');
        await simulatePayment(selectedPlan);
        return;
      }

      // Initialize DodoPayments checkout
      const dodo = (window as any).DodoPayments;
      const checkout = await dodo.createCheckout(dodoConfig);
      
      // Open checkout
      checkout.open();

      // Listen for payment success
      checkout.on('success', (paymentData: any) => {
        handlePaymentSuccess(paymentData.paymentId, selectedPlan);
      });

      checkout.on('cancel', () => {
        setIsProcessing(false);
        toast({
          title: "Payment cancelled",
          description: "You can upgrade anytime from settings.",
        });
      });

    } catch (error) {
      console.error('Payment error:', error);
      toast({
        title: "Payment failed",
        description: "Please try again or contact support.",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  const simulatePayment = async (plan: 'weekly' | 'yearly' | 'lifetime') => {
    // Simulate payment processing delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const mockPaymentId = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    handlePaymentSuccess(mockPaymentId, plan);
  };

  const handlePaymentSuccess = (paymentId: string, plan: 'weekly' | 'yearly' | 'lifetime') => {
    // Save subscription to localStorage
    saveSubscription(plan, paymentId);

    // Track purchase completed
    posthogEvents.purchaseCompleted(plan, plans[plan].price, paymentId);

    setIsProcessing(false);

    toast({
      title: "🎉 Subscription activated!",
      description: `You now have ${plan === 'lifetime' ? 'lifetime' : 'unlimited'} access to neural optimization.`,
    });

    // Notify parent component
    onSubscribed?.();

    // Close modal
    onClose();
  };

  const getModalContent = () => {
    if (mode === 'preview-limit') {
      return {
        title: title || "Unlock Full Audio Access",
        description: description || "Subscribe to listen to the complete neural-optimized audio and download it.",
      };
    }
    if (mode === 'conversion-limit') {
      return {
        title: title || "Free Conversion Used",
        description: description || "You've used your free conversion. Upgrade to Pro for unlimited conversions.",
      };
    }
    return {
      title: title || "Unlock Unlimited Neural Optimization",
      description: description || "Upgrade to Pro for unlimited conversions and full audio access.",
    };
  };

  const content = getModalContent();

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] p-0 gap-0 bg-card border-primary/20 overflow-hidden flex flex-col" hideCloseButton ariaTitle={content.title}>

        {/* Header */}
        <div className="relative p-4 sm:p-6 pb-4 border-b border-border/50 flex-shrink-0">
          <div className="absolute inset-0 mesh-background opacity-50" />

          <div className="relative flex flex-col items-center text-center">
            <div className="p-2 sm:p-3 rounded-xl bg-gradient-to-br from-primary to-accent mb-2 sm:mb-3 animate-pulse-glow">
              <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h2 className="text-lg sm:text-2xl font-bold mb-1 sm:mb-2">
              {content.title.split(' ').map((word, i) =>
                word === 'Unlimited' || word === 'Full' || word === 'Pro' ? (
                  <span key={i} className="gradient-text">{word} </span>
                ) : (
                  <span key={i}>{word} </span>
                )
              )}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {content.description}
            </p>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1">
          <div className="p-4 sm:p-6">
            {/* Plan selector */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {/* Weekly Plan */}
              <button
                onClick={() => setSelectedPlan("weekly")}
                className={`p-2 sm:p-4 rounded-xl border-2 transition-all ${
                  selectedPlan === "weekly"
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
              >
                <div className="text-left">
                  <p className="font-semibold text-xs sm:text-sm">Weekly</p>
                  <p className="text-base sm:text-xl font-bold mt-0.5 sm:mt-1">{plans.weekly.displayPrice}</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{plans.weekly.description}</p>
                </div>
              </button>

              {/* Yearly Plan */}
              <button
                onClick={() => setSelectedPlan("yearly")}
                className={`p-2 sm:p-4 rounded-xl border-2 transition-all relative ${
                  selectedPlan === "yearly"
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {/* 90% OFF Badge - Top Right */}
                <div className="absolute -top-2 -right-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs sm:text-sm font-black shadow-lg animate-pulse-glow z-10">
                  90% OFF
                </div>
                {plans.yearly.badge && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 sm:px-2 py-0.5 rounded-lg bg-gradient-to-r from-accent to-primary text-white text-[8px] sm:text-[10px] font-bold shadow-lg whitespace-nowrap">
                    {plans.yearly.badge}
                  </div>
                )}
                <div className="text-left">
                  <p className="font-semibold text-xs sm:text-sm">Yearly</p>
                  <div className="flex items-baseline gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                    <p className="text-base sm:text-xl font-bold">{plans.yearly.displayPrice}</p>
                  </div>
                  <p className="text-[8px] sm:text-[10px] text-accent font-medium">
                    Save $375
                  </p>
                </div>
              </button>

              {/* Lifetime Plan */}
              <button
                onClick={() => setSelectedPlan("lifetime")}
                className={`p-2 sm:p-4 rounded-xl border-2 transition-all relative ${
                  selectedPlan === "lifetime"
                    ? "border-primary bg-primary/10 shadow-lg shadow-primary/20"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {plans.lifetime.badge && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 sm:px-2 py-0.5 rounded-lg bg-gradient-to-r from-primary to-accent text-white text-[8px] sm:text-[10px] font-bold shadow-lg whitespace-nowrap">
                    POPULAR
                  </div>
                )}
                <div className="text-left">
                  <p className="font-semibold text-xs sm:text-sm">Lifetime</p>
                  <div className="flex items-baseline gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                    <p className="text-base sm:text-xl font-bold">{plans.lifetime.displayPrice}</p>
                  </div>
                  <p className="text-[8px] sm:text-[10px] text-accent font-medium">
                    {plans.lifetime.savings}
                  </p>
                </div>
              </button>
            </div>

            {/* Features - Updated with new data */}
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 sm:gap-3 mb-4 sm:mb-6">
              {[
                "Unlimited 8D conversions",
                "Full-length audio playback",
                "Advanced beat detection",
                "Beat-synced panning",
                "Spatial depth effects",
                "Bass boost (6dB)",
                "High-quality WAV downloads",
                "Priority processing speed",
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="p-0.5 sm:p-1 rounded-full bg-accent/20 flex-shrink-0">
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-accent" />
                  </div>
                  <span className="text-xs sm:text-sm">{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Button
              variant="neural"
              size="lg"
              className="w-full mb-3 gap-2 h-12 sm:h-auto text-sm sm:text-base"
              onClick={handleUpgrade}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Subscribe {selectedPlan === 'lifetime' ? 'Lifetime' : selectedPlan === 'weekly' ? 'Weekly' : 'Yearly'} - {plans[selectedPlan].displayPrice}</span>
                  <span className="sm:hidden">Get {selectedPlan === 'lifetime' ? 'Lifetime' : selectedPlan === 'weekly' ? 'Weekly' : 'Yearly'} - {plans[selectedPlan].displayPrice}</span>
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={handleClose}
              className="w-full text-sm sm:text-base h-10 sm:h-auto text-muted-foreground"
              disabled={isProcessing}
            >
              Maybe Later
            </Button>

            <p className="text-[10px] sm:text-xs text-center text-muted-foreground mt-2 sm:mt-3">
              Secure payment powered by DodoPayments
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
