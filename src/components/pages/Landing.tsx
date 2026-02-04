'use client';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hero } from "@/components/landing/Hero";
import { BenefitCards } from "@/components/landing/BenefitCards";
import { Testimonials } from "@/components/landing/Testimonials";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { EmailCapture } from "@/components/landing/EmailCapture";
import { OnboardingQuiz } from "@/components/OnboardingQuiz";
import { AuthModal } from "@/components/AuthModal";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Brain, Headphones, ArrowRight } from "lucide-react";

export default function Landing() {
  const router = useRouter();
  const { updatePreferences, shouldShowQuiz } = useUserPreferences();
  const { user } = useAuth();
  const [showQuiz, setShowQuiz] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Prefetch dashboard route for faster navigation
  useEffect(() => {
    router.prefetch('/dashboard');
  }, [router]);

  // Auto-show quiz on first visit (after a delay)
  useEffect(() => {
    if (shouldShowQuiz) {
      const timer = setTimeout(() => {
        setShowQuiz(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [shouldShowQuiz]);

  const handleActivate = () => {
    // Go directly to dashboard without auth check
    if (shouldShowQuiz) {
      setShowQuiz(true);
    } else {
      router.push("/dashboard");
    }
  };

  const handleQuizComplete = (answers: { goal: string; hasADHD: string; intensity: string }) => {
    updatePreferences({
      ...answers,
      hasCompletedQuiz: true,
    });
    setShowQuiz(false);
    router.push("/dashboard");
  };

  const handleEmailSubscribe = (email: string) => {
    updatePreferences({ email });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-accent">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl gradient-text">NeuralWave</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" prefetch={true}>
              <Button type="button" variant="neural" className="gap-2">
                {user ? 'Dashboard' : 'Get Started'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>
        <Hero onActivate={handleActivate} />
        <BenefitCards />
        <HowItWorks />
        <Testimonials />

        {/* Final CTA section */}
        <section className="relative py-24 px-4">
          <div className="absolute inset-0 mesh-background opacity-40" />
          <div className="relative max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
              Ready to <span className="gradient-text">Focus Better</span> With Your Favorite Music?
            </h2>
            <p className="text-lg text-muted-foreground mb-4">
              Transform any song into brain-boosting 8D audio in seconds
            </p>
            <p className="text-base text-muted-foreground mb-8 flex items-center justify-center gap-2">
              <Headphones className="w-4 h-4 text-primary" />
              Perfect for studying, working, or managing ADHD
            </p>
            <Link href="/dashboard" prefetch={true}>
              <Button variant="hero" size="xl" className="gap-2 shadow-xl shadow-primary/25">
                Start Converting Now
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-4">
              Free to use • No account required • Instant results
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8 px-4 mb-20 sm:mb-0">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold">NeuralWave</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Support</a>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 NeuralWave. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Modals */}
      <OnboardingQuiz
        open={showQuiz}
        onComplete={handleQuizComplete}
        onClose={() => setShowQuiz(false)}
      />

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode="signup"
        title="Get Your Free Conversion"
        description="Sign up to save your tracks and get unlimited conversions!"
      />

      {/* Sticky email capture */}
      <EmailCapture onSubscribe={handleEmailSubscribe} />
    </div>
  );
}
