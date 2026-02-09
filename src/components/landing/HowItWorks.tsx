import { Upload, Wand2, Headphones } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Your Track",
    description: "Drop any MP3, WAV, or paste a YouTube link. Your favorite music becomes the foundation.",
    accent: "bg-warm",
  },
  {
    number: "02",
    icon: Wand2,
    title: "Neural Optimization",
    description: "Our algorithm adds binaural beats and 8D spatial audio tuned to your brain profile.",
    accent: "bg-brand-light",
  },
  {
    number: "03",
    icon: Headphones,
    title: "Experience the Difference",
    description: "Put on headphones and feel your focus sharpen as the optimized audio activates your brain.",
    accent: "bg-accent",
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-24 sm:py-32 px-4 bg-secondary/50">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-primary tracking-widest uppercase mb-3">
            How It Works
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Three simple steps
          </h2>
          <p className="text-base text-muted-foreground max-w-lg mx-auto">
            Transform any song in under a minute
          </p>
        </div>

        {/* Steps */}
        <div className="grid md:grid-cols-3 gap-8 md:gap-6">
          {steps.map((step, index) => (
            <div
              key={step.number}
              className="relative animate-fade-up"
              style={{ animationDelay: `${index * 0.15}s` }}
            >
              {/* Connector line (desktop only) */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-14 left-[calc(50%+40px)] right-[calc(-50%+40px)] h-px bg-border" />
              )}

              <div className="relative p-8 rounded-2xl bg-card border border-border text-center">
                {/* Step number */}
                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-bold mb-6">
                  {step.number}
                </div>

                {/* Icon */}
                <div className={`inline-flex p-4 rounded-xl ${step.accent} mb-6 mx-auto`}>
                  <step.icon className="w-6 h-6 text-foreground" />
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
