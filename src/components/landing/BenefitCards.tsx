import { Brain, Focus, Headphones } from "lucide-react";

const benefits = [
  {
    icon: Brain,
    title: "Bilateral Brain Activation",
    description: "Stimulate both hemispheres simultaneously with precisely tuned stereo frequencies that create a synchronized neural response.",
    color: "bg-brand-light text-primary",
  },
  {
    icon: Focus,
    title: "ADHD Focus Enhancement",
    description: "Specially designed binaural beats help regulate attention and reduce mental noise, making focus effortless and natural.",
    color: "bg-accent text-accent-foreground",
  },
  {
    icon: Headphones,
    title: "Immersive 8D Experience",
    description: "Audio that moves around your head creates an enveloping soundscape that blocks out distractions and deepens concentration.",
    color: "bg-warm text-amber-700",
  },
];

export function BenefitCards() {
  return (
    <section className="relative py-24 sm:py-32 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-primary tracking-widest uppercase mb-3">
            The Science
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Why it works
          </h2>
          <p className="text-base text-muted-foreground max-w-lg mx-auto">
            Audio engineered for maximum cognitive impact
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className="group relative p-8 rounded-2xl bg-card border border-border hover:border-primary/15 hover:shadow-lg hover:shadow-primary/[0.04] transition-all duration-300 animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Icon */}
              <div className={`inline-flex p-3 rounded-xl ${benefit.color} mb-6`}>
                <benefit.icon className="w-5 h-5" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold mb-3">
                {benefit.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
