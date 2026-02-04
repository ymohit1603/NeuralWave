'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Headphones, ArrowRight } from "lucide-react";

interface HeroProps {
  onActivate: () => void;
}

export function Hero({ onActivate: _onActivate }: HeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-20">
      {/* Mesh background */}
      <div className="absolute inset-0 mesh-background opacity-60" />

      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/20 rounded-full blur-[100px] animate-pulse-glow" style={{ animationDelay: '1.5s' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-neural-pink/10 rounded-full blur-[150px] animate-float" />

      <div className="relative z-10 max-w-5xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full glass-card border border-primary/30 animate-fade-in">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-muted-foreground">
            Trusted by 10,000+ users worldwide
          </span>
        </div>

        {/* Main headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-up">
          Transform Any Song Into{" "}
          <span className="gradient-text">Brain-Boosting</span>{" "}
          8D Audio
        </h1>

        {/* Subheading */}
        <p className="text-lg sm:text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          Bilateral audio stimulation that helps you{" "}
          <span className="text-accent font-medium">focus deeper</span>,{" "}
          <span className="text-accent font-medium">study longer</span>, and{" "}
          <span className="text-accent font-medium">feel calmer</span>
        </p>

        {/* ADHD callout */}
        <p className="text-base sm:text-lg text-muted-foreground mb-10 animate-fade-up" style={{ animationDelay: '0.15s' }}>
          <Headphones className="w-4 h-4 inline mr-1.5 text-primary" />
          Especially effective for <span className="text-primary font-semibold">ADHD brains</span>
        </p>

        {/* CTA Button with prefetch */}
        <div className="flex flex-col items-center justify-center gap-4 mb-16 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <Link href="/dashboard" prefetch={true}>
            <Button
              type="button"
              variant="hero"
              size="lg"
              className="group w-auto sm:w-auto text-lg px-8 py-4 h-auto shadow-xl shadow-primary/25"
            >
              Convert Your First Song
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-accent" />
            Free to use • No account required • Instant results
          </p>
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Works Instantly</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>No Download Required</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Science-Backed</span>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full border-2 border-muted-foreground/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 rounded-full bg-muted-foreground/50 animate-pulse" />
        </div>
      </div>
    </section>
  );
}
