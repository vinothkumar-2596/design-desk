import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { LottieLoader } from '@/components/LottieLoader';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type SubmissionSuccessDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  actionLabel: string;
  onAction: () => void;
  requestTitle?: string | null;
  requestLabel?: string;
};

export function SubmissionSuccessDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  onAction,
}: SubmissionSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <div className="relative h-44 bg-primary/10">
          <LottieLoader src="/lottie/thank-you.json" className="h-full w-full" />
        </div>

        <div className="px-7 pb-7 pt-5 text-center">
          <DialogHeader className="text-center sm:text-center">
            <DialogTitle className="text-2xl font-bold text-foreground premium-headline">
              {title}
            </DialogTitle>
            <DialogDescription className="mt-2.5 text-sm text-muted-foreground">
              {description}
            </DialogDescription>
          </DialogHeader>

          <Button className="mt-8 w-full" onClick={onAction}>
            {actionLabel}
          </Button>

          <div className="mt-6 border-t border-border/60 pb-2 pt-4 text-center text-[11px] text-muted-foreground">
            For assistance, please contact the coordinator at{' '}
            <a href="tel:+919360960019" className="font-medium text-foreground/80 hover:text-foreground">
              +91 9360960019
            </a>{' '}
            or{' '}
            <a
              href="mailto:design@smvec.ac.in"
              className="font-medium text-foreground/80 hover:text-foreground"
            >
              design@smvec.ac.in
            </a>
            .
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
