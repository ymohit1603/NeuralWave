'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Headphones } from "lucide-react";

interface HeroProps {
  onActivate: () => void;
}

export function Hero({ onActivate: _onActivate }: HeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-4 pt-24 pb-20 hero-gradient overflow-hidden">
      {/* Subtle decorative ring */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] sm:w-[800px] sm:h-[800px] rounded-full border border-primary/[0.04] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] sm:w-[550px] sm:h-[550px] rounded-full border border-primary/[0.06] pointer-events-none" />

      <div className="relative z-10 max-w-3xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full bg-brand-light border border-primary/10 text-xs font-medium text-primary animate-fade-in">
          <Headphones className="w-3 h-3" />
          Trusted by 10,000+ users worldwide
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-up leading-[1.08]">
          Transform Any Song
          <br />
          <span className="text-primary">Into 8D Audio</span>
        </h1>

        {/* Subheading */}
        <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto mb-4 animate-fade-up leading-relaxed" style={{ animationDelay: '0.1s' }}>
          Bilateral audio stimulation that helps you focus deeper, study longer, and feel calmer.
        </p>

        {/* ADHD callout */}
        <p className="text-sm text-brand-muted font-medium mb-12 animate-fade-up" style={{ animationDelay: '0.15s' }}>
          Especially effective for ADHD brains
        </p>

        {/* CTA Button */}
        <div className="flex flex-col items-center justify-center gap-4 mb-16 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <Link href="/dashboard" prefetch={true}>
            <Button
              type="button"
              variant="default"
              size="lg"
              className="group text-base px-8 py-5 h-auto shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/25 transition-all"
            >
              Convert Your First Song
              <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-0.5 transition-transform" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground">
            Free to use · No account required · Instant results
          </p>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Works Instantly</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
            <span>No Download Required</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Science-Backed</span>
          </div>
        </div>
      </div>
    </section>
  );
}
