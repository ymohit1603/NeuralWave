import { Brain, Focus, Headphones } from "lucide-react";

const benefits = [
  {
    icon: Brain,
    title: "Bilateral Brain Activation",
    description: "Stimulate both hemispheres simultaneously with precisely tuned stereo frequencies that create a synchronized neural response.",
    gradient: "from-primary to-neural-blue",
  },
  {
    icon: Focus,
    title: "ADHD Focus Enhancement",
    description: "Specially designed binaural beats help regulate attention and reduce mental noise, making focus effortless and natural.",
    gradient: "from-neural-purple to-neural-pink",
  },
  {
    icon: Headphones,
    title: "Immersive 8D Experience",
    description: "Audio that moves around your head creates an enveloping soundscape that blocks out distractions and deepens concentration.",
    gradient: "from-accent to-neural-blue",
  },
];

export function BenefitCards() {
  return (
    <section className="relative py-24 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Why Your Brain Will <span className="gradient-text">Thank You</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience audio engineered for maximum cognitive impact
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {benefits.map((benefit, index) => (
            <div
              key={benefit.title}
              className="group relative p-8 rounded-2xl glass-card border border-white/5 hover:border-primary/30 transition-all duration-500 animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Gradient glow on hover */}
              <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${benefit.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
              
              {/* Icon */}
              <div className={`relative inline-flex p-4 rounded-xl bg-gradient-to-br ${benefit.gradient} mb-6`}>
                <benefit.icon className="w-6 h-6 text-white" />
              </div>

              {/* Content */}
              <h3 className="relative text-xl font-semibold mb-3 group-hover:text-primary transition-colors duration-300">
                {benefit.title}
              </h3>
              <p className="relative text-muted-foreground leading-relaxed">
                {benefit.description}
              </p>

              {/* Decorative corner */}
              <div className="absolute top-4 right-4 w-20 h-20 opacity-5">
                <benefit.icon className="w-full h-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
