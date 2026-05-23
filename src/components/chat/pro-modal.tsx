'use client';

import { Sparkles } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface ProModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modelName?: string;
}

export function ProModal({ open, onOpenChange, modelName }: ProModalProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md glass-panel border-border/30">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            {modelName ? `${modelName} is a Pro Model` : 'Pro Coming Soon'}
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground">
            Premium AI models with superior reasoning, larger context windows, and faster responses.
            We&apos;re working on making them available.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              'Premium AI models (Claude, GPT-4, Gemini Pro)',
              'Larger context windows (up to 1M tokens)',
              'Priority inference — no rate limits',
              'Advanced reasoning & code generation',
            ].map((benefit) => (
              <div key={benefit} className="flex items-start gap-2 text-sm">
                <Badge variant="info" className="shrink-0 text-[10px] px-1.5 py-0.5">
                  Pro
                </Badge>
                <span className="text-muted-foreground">{benefit}</span>
              </div>
            ))}
          </div>

          {!submitted ? (
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 rounded-xl"
              />
              <Button
                className="rounded-xl px-4"
                disabled={!email.includes('@')}
                onClick={() => setSubmitted(true)}
              >
                Notify Me
              </Button>
            </div>
          ) : (
            <p className="text-center text-sm text-primary font-medium py-2">
              You&apos;re on the list! We&apos;ll reach out when Pro launches.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
