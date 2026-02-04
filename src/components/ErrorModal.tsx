'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, X } from "lucide-react";

interface ErrorModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  details?: string;
  onRetry?: () => void;
}

export function ErrorModal({
  open,
  onClose,
  title = "Something went wrong",
  message,
  details,
  onRetry
}: ErrorModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-destructive/10">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            {title}
          </DialogTitle>
          <DialogDescription className="text-center">
            {message}
          </DialogDescription>
        </DialogHeader>

        {details && (
          <div className="mt-4 p-3 rounded-lg bg-secondary/50 border border-border">
            <p className="text-xs text-muted-foreground font-mono break-all">
              {details}
            </p>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          {onRetry && (
            <Button
              variant="default"
              onClick={() => {
                onClose();
                onRetry();
              }}
              className="flex-1"
            >
              Try Again
            </Button>
          )}
          <Button
            variant={onRetry ? "outline" : "default"}
            onClick={onClose}
            className="flex-1"
          >
            {onRetry ? "Cancel" : "Close"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
