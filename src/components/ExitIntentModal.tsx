import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Gift, X } from "lucide-react";

interface ExitIntentModalProps {
  open: boolean;
  onClose: () => void;
  onClaim: (email: string) => void;
}

export function ExitIntentModal({ open, onClose, onClaim }: ExitIntentModalProps) {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      onClaim(email);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-0 gap-0 bg-white border-border overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-secondary transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header */}
        <div className="relative h-32 bg-primary overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="p-4 rounded-full bg-white/20 backdrop-blur-sm">
              <Gift className="w-10 h-10 text-white" />
            </div>
          </div>
        </div>

        <div className="p-6 text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">
            Wait! Get Your First Neural Track Free
          </h2>
          <p className="text-muted-foreground mb-6">
            Drop your email and we'll send you a pre-optimized focus track plus
            exclusive tips for maximizing brain activation.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-secondary border-border text-center"
              required
            />
            <Button type="submit" variant="default" size="lg" className="w-full gap-2">
              <Gift className="w-4 h-4" />
              Claim My Free Track
            </Button>
          </form>

          <p className="text-xs text-muted-foreground mt-4">
            No spam, ever. Unsubscribe anytime.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
