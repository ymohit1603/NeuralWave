import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Brain, ArrowRight, Sparkles, Target, Zap, BookOpen, Moon } from "lucide-react";

interface OnboardingQuizProps {
  open: boolean;
  onComplete: (answers: QuizAnswers) => void;
  onClose: () => void;
}

interface QuizAnswers {
  goal: string;
  hasADHD: string;
  intensity: string;
  hasOnboarded?: boolean;
}

const goalOptions = [
  { value: "focus", label: "Deep Focus", description: "Concentrate for hours", icon: Target, color: "from-blue-500 to-cyan-500" },
  { value: "study", label: "Study & Learn", description: "Retain more information", icon: BookOpen, color: "from-purple-500 to-pink-500" },
  { value: "energy", label: "Get Energized", description: "Boost motivation", icon: Zap, color: "from-orange-500 to-yellow-500" },
  { value: "relaxation", label: "Relax & Unwind", description: "Reduce stress", icon: Moon, color: "from-indigo-500 to-purple-500" },
];

export function OnboardingQuiz({ open, onComplete, onClose }: OnboardingQuizProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [isAnimating, setIsAnimating] = useState(false);

  const handleGoalSelect = (goal: string) => {
    setIsAnimating(true);
    setAnswers({ ...answers, goal });
    setTimeout(() => {
      setStep(1);
      setIsAnimating(false);
    }, 300);
  };

  const handleADHDSelect = (hasADHD: string) => {
    setIsAnimating(true);
    setAnswers({ ...answers, hasADHD });
    setTimeout(() => {
      setStep(2);
      setIsAnimating(false);
    }, 300);
  };

  const handleIntensitySelect = (intensity: string) => {
    const finalAnswers = { ...answers, intensity, hasOnboarded: true } as QuizAnswers;
    setAnswers(finalAnswers);
    onComplete(finalAnswers);
  };

  const handleSkip = () => {
    onComplete({
      goal: 'focus',
      hasADHD: 'no',
      intensity: 'moderate',
      hasOnboarded: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent
        className="sm:max-w-md p-0 gap-0 bg-card border-primary/20 overflow-hidden"
        hideCloseButton
        ariaTitle="Personalize Your Experience"
      >
        {/* Step 0: Goal Selection */}
        {step === 0 && (
          <div className={`p-6 transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
            {/* Header */}
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold mb-2">
                What's your goal?
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                We'll optimize the audio for your needs
              </p>
            </div>

            {/* Goal Options */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {goalOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleGoalSelect(option.value)}
                  className="group p-4 rounded-xl border border-border hover:border-primary/50 bg-card hover:bg-primary/5 transition-all duration-200 text-left"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${option.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                    <option.icon className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold text-sm">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </button>
              ))}
            </div>

            {/* Skip */}
            <button
              onClick={handleSkip}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip personalization →
            </button>
          </div>
        )}

        {/* Step 1: ADHD Question */}
        {step === 1 && (
          <div className={`p-6 transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold mb-2">
                Do you have ADHD?
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Our bilateral audio is especially effective for ADHD brains
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { value: "yes", label: "Yes", desc: "Optimize for ADHD focus" },
                { value: "sometimes", label: "I struggle with focus", desc: "Enhanced concentration mode" },
                { value: "no", label: "No", desc: "Standard optimization" },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleADHDSelect(option.value)}
                  className="w-full p-4 rounded-xl border border-border hover:border-primary/50 bg-card hover:bg-primary/5 transition-all duration-200 text-left flex items-center justify-between group"
                >
                  <div>
                    <p className="font-semibold">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.desc}</p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(0)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step 2: Intensity */}
        {step === 2 && (
          <div className={`p-6 transition-opacity duration-300 ${isAnimating ? 'opacity-0' : 'opacity-100'}`}>
            <div className="text-center mb-6">
              <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-primary to-accent mb-4">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <DialogTitle className="text-2xl font-bold mb-2">
                Effect intensity?
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                How noticeable should the 8D effect be?
              </p>
            </div>

            <div className="space-y-3 mb-6">
              {[
                { value: "subtle", label: "Subtle", desc: "Gentle, background enhancement", bars: 1 },
                { value: "moderate", label: "Moderate", desc: "Balanced and noticeable", bars: 2 },
                { value: "intense", label: "Intense", desc: "Maximum brain activation", bars: 3 },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleIntensitySelect(option.value)}
                  className="w-full p-4 rounded-xl border border-border hover:border-primary/50 bg-card hover:bg-primary/5 transition-all duration-200 text-left flex items-center justify-between group"
                >
                  <div>
                    <p className="font-semibold">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.desc}</p>
                  </div>
                  <div className="flex gap-1 items-end">
                    {[1, 2, 3].map((bar) => (
                      <div
                        key={bar}
                        className={`w-2 rounded-full transition-all ${
                          bar <= option.bars
                            ? 'h-4 bg-gradient-to-t from-primary to-accent'
                            : 'h-2 bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setStep(1)}
              className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Progress indicator */}
        <div className="px-6 pb-4">
          <div className="flex justify-center gap-2">
            {[0, 1, 2].map((s) => (
              <div
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step ? 'w-8 bg-primary' : s < step ? 'w-4 bg-accent' : 'w-4 bg-muted'
                }`}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
