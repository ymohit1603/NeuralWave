import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah M.",
    role: "Software Developer",
    avatar: "S",
    content: "As someone with ADHD, finding focus has always been a struggle. NeuralWave transformed my work sessions - I can actually concentrate for hours now. It's like my brain finally found its rhythm.",
    rating: 5,
  },
  {
    name: "Marcus T.",
    role: "Graduate Student",
    avatar: "M",
    content: "I was skeptical at first, but the difference is undeniable. My study sessions went from 20 frustrating minutes to 3+ hour deep work blocks. This is a game-changer for anyone with focus challenges.",
    rating: 5,
  },
  {
    name: "Emily R.",
    role: "Creative Director",
    avatar: "E",
    content: "The 8D audio effect is incredible - it's like the music wraps around your brain and quiets everything else. I use it daily and my productivity has never been better.",
    rating: 5,
  },
  {
    name: "David K.",
    role: "Entrepreneur",
    avatar: "D",
    content: "Finally, something that actually works. I've tried every focus app out there, but NeuralWave is the only one where I can feel the difference immediately. Worth every penny.",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 px-4 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 mesh-background opacity-30" />
      
      <div className="relative max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-4 rounded-full glass-card border border-accent/30">
            <span className="text-accent font-medium">10,000+ Focus-Optimized Users</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Real Results, Real <span className="gradient-text">Focus</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Join thousands who've transformed their concentration
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-2 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="group p-6 rounded-2xl glass-card border border-white/5 hover:border-primary/20 transition-all duration-500 animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                ))}
              </div>

              {/* Content */}
              <p className="text-foreground/90 leading-relaxed mb-6">
                "{testimonial.content}"
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-sm font-semibold text-white">
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="font-medium">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
