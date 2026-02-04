import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, CheckCircle, X } from "lucide-react";

interface EmailCaptureProps {
  onSubscribe?: (email: string) => void;
}

export function EmailCapture({ onSubscribe }: EmailCaptureProps) {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onSubscribe?.(email);
      setIsSubmitted(true);
      setTimeout(() => setIsVisible(false), 3000);
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 p-4 glass-card border-t border-primary/20">
      <div className="max-w-4xl mx-auto">
        {isSubmitted ? (
          <div className="flex items-center justify-center gap-3 py-2 animate-fade-in">
            <CheckCircle className="w-5 h-5 text-accent" />
            <span className="font-medium">You're in! Check your inbox for focus playlists.</span>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button 
              onClick={() => setIsVisible(false)}
              className="absolute top-2 right-2 sm:static p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="p-2 rounded-lg bg-primary/20">
                <Mail className="w-5 h-5 text-primary" />
              </div>
              <div className="text-left">
                <div className="font-semibold">Get Weekly Focus Playlists</div>
                <div className="text-sm text-muted-foreground hidden sm:block">
                  Curated neural-optimized tracks delivered every Friday
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2 flex-1 w-full sm:w-auto max-w-md">
              <Input
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 bg-background/50 border-primary/20 focus:border-primary"
                required
              />
              <Button type="submit" variant="neural" className="whitespace-nowrap">
                Subscribe
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
