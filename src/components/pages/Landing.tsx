'use client';

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Hero } from "@/components/landing/Hero";
import { AuthModal } from "@/components/AuthModal";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Headphones, ArrowRight } from "lucide-react";
import { posthogEvents } from "@/lib/posthog";

const BenefitCards = lazy(() => import("@/components/landing/BenefitCards").then(m => ({ default: m.BenefitCards })));
const Testimonials = lazy(() => import("@/components/landing/Testimonials").then(m => ({ default: m.Testimonials })));
const HowItWorks = lazy(() => import("@/components/landing/HowItWorks").then(m => ({ default: m.HowItWorks })));
const EmailCapture = lazy(() => import("@/components/landing/EmailCapture").then(m => ({ default: m.EmailCapture })));

export default function Landing() {
  const router = useRouter();
  const { updatePreferences } = useUserPreferences();
  const { user } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const pageLoadTime = useRef(Date.now());
  const hasTrackedView = useRef(false);

  // Prefetch dashboard routes for faster navigation
  useEffect(() => {
    router.prefetch('/dashboard');
  }, [router]);

  // Track home page view
  useEffect(() => {
    if (!hasTrackedView.current) {
      posthogEvents.homeViewed();
      hasTrackedView.current = true;
    }

    // Track bounce on unmount
    return () => {
      const timeOnPage = Math.floor((Date.now() - pageLoadTime.current) / 1000);
      // Consider it a bounce if user leaves within 10 seconds without navigating to dashboard
      if (timeOnPage < 10) {
        posthogEvents.homeBounced(timeOnPage);
      }
    };
  }, []);

  const handleActivate = () => {
    // Go directly to dashboard
    router.push("/dashboard");
  };

  const handleEmailSubscribe = (email: string) => {
    updatePreferences({ email });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 px-4 py-4 bg-background/80 backdrop-blur-lg border-b border-transparent">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary">
              <Headphones className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">NeuralWave</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" prefetch={true}>
              <Button type="button" variant="default" size="sm" className="gap-2 shadow-md shadow-primary/15">
                {user ? 'Dashboard' : 'Get Started'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main>
        <Hero onActivate={handleActivate} />
        <Suspense fallback={null}>
          <BenefitCards />
          <HowItWorks />
          <Testimonials />
        </Suspense>

        {/* Final CTA section */}
        <section className="relative py-28 sm:py-36 px-4 bg-primary text-primary-foreground overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.05)_0%,_transparent_70%)]" />

          <div className="relative max-w-2xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-5">
              Ready to focus better?
            </h2>
            <p className="text-base text-white/70 mb-4 max-w-lg mx-auto">
              Transform any song into brain-boosting 8D audio in seconds.
            </p>
            <p className="text-sm text-white/50 mb-10 flex items-center justify-center gap-2">
              Perfect for studying, working, or managing ADHD
            </p>
            <Link href="/dashboard" prefetch={true}>
              <Button variant="secondary" size="lg" className="gap-2 text-foreground shadow-lg">
                Start Converting
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
            <p className="text-xs text-white/40 mt-5">
              Free to use · No account required · Instant results
            </p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4 mb-20 sm:mb-0 bg-secondary/30">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-primary">
              <Headphones className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">NeuralWave</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <a href="#" className="hover:text-foreground transition-colors">Support</a>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2024 NeuralWave. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode="signup"
        title="Get Your Free Conversion"
        description="Sign up to save your tracks and get unlimited conversions!"
      />

      {/* Sticky email capture */}
      <Suspense fallback={null}>
        <EmailCapture onSubscribe={handleEmailSubscribe} />
      </Suspense>
    </div>
  );
}
