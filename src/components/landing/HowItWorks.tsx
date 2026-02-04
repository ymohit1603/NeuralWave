import { Upload, Wand2, Headphones, ArrowRight } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload Your Track",
    description: "Drop any MP3, WAV, or paste a YouTube link. Your favorite music becomes the foundation.",
  },
  {
    number: "02",
    icon: Wand2,
    title: "Neural Optimization",
    description: "Our algorithm adds binaural beats and 8D spatial audio tuned to your brain profile.",
  },
  {
    number: "03",
    icon: Headphones,
    title: "Experience the Difference",
    description: "Put on headphones and feel your focus sharpen as the optimized audio activates your brain.",
  },
];

export function HowItWorks() {
  return (
    <section className="relative py-24 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Three Steps to <span className="gradient-text">Brain Activation</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Transform any song in under a minute
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection line - desktop */}
          <div className="hidden md:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent -translate-y-1/2" />

          <div className="grid md:grid-cols-3 gap-8 md:gap-4">
            {steps.map((step, index) => (
              <div
                key={step.number}
                className="relative group animate-fade-up"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                {/* Card */}
                <div className="relative p-8 rounded-2xl glass-card border border-white/5 text-center hover:border-primary/30 transition-all duration-500">
                  {/* Step number */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-primary to-accent text-sm font-bold">
                    {step.number}
                  </div>

                  {/* Icon container */}
                  <div className="relative inline-flex p-5 rounded-2xl glass-card border border-primary/20 mb-6 mt-4 group-hover:border-primary/40 group-hover:shadow-lg group-hover:shadow-primary/10 transition-all duration-500">
                    <step.icon className="w-8 h-8 text-primary" />
                    
                    {/* Animated ring */}
                    <div className="absolute inset-0 rounded-2xl border-2 border-primary/0 group-hover:border-primary/30 group-hover:scale-110 transition-all duration-500" />
                  </div>

                  {/* Content */}
                  <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                  <p className="text-muted-foreground">{step.description}</p>
                </div>

                {/* Arrow between steps - desktop */}
                {index < steps.length - 1 && (
                  <div className="hidden md:flex absolute top-1/2 -right-4 z-10 w-8 h-8 items-center justify-center rounded-full bg-card border border-primary/30 text-primary -translate-y-1/2">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
