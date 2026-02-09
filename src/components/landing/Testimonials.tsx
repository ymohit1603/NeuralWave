import { Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah M.",
    role: "Software Developer",
    avatar: "S",
    avatarBg: "bg-brand-light text-primary",
    content: "As someone with ADHD, finding focus has always been a struggle. NeuralWave transformed my work sessions - I can actually concentrate for hours now. It's like my brain finally found its rhythm.",
    rating: 5,
  },
  {
    name: "Marcus T.",
    role: "Graduate Student",
    avatar: "M",
    avatarBg: "bg-accent text-accent-foreground",
    content: "I was skeptical at first, but the difference is undeniable. My study sessions went from 20 frustrating minutes to 3+ hour deep work blocks. This is a game-changer for anyone with focus challenges.",
    rating: 5,
  },
  {
    name: "Emily R.",
    role: "Creative Director",
    avatar: "E",
    avatarBg: "bg-warm text-amber-700",
    content: "The 8D audio effect is incredible - it's like the music wraps around your brain and quiets everything else. I use it daily and my productivity has never been better.",
    rating: 5,
  },
  {
    name: "David K.",
    role: "Entrepreneur",
    avatar: "D",
    avatarBg: "bg-brand-light text-primary",
    content: "Finally, something that actually works. I've tried every focus app out there, but NeuralWave is the only one where I can feel the difference immediately. Worth every penny.",
    rating: 5,
  },
];

export function Testimonials() {
  return (
    <section className="relative py-24 sm:py-32 px-4">
      <div className="relative max-w-5xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-xs font-semibold text-primary tracking-widest uppercase mb-3">
            10,000+ Users
          </p>
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
            Real results
          </h2>
          <p className="text-base text-muted-foreground max-w-lg mx-auto">
            Join thousands who've transformed their concentration
          </p>
        </div>

        {/* Testimonials grid */}
        <div className="grid md:grid-cols-2 gap-5">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="p-6 rounded-2xl bg-card border border-border hover:shadow-md hover:shadow-primary/[0.03] transition-all duration-300 animate-fade-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* Stars */}
              <div className="flex gap-0.5 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>

              {/* Content */}
              <p className="text-sm text-foreground/80 leading-relaxed mb-6">
                &ldquo;{testimonial.content}&rdquo;
              </p>

              {/* Author */}
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-full ${testimonial.avatarBg} flex items-center justify-center text-xs font-semibold`}>
                  {testimonial.avatar}
                </div>
                <div>
                  <div className="text-sm font-medium">{testimonial.name}</div>
                  <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
