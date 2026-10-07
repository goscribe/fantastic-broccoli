import { forwardRef } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ctaProps, type CtaPosition } from "@/lib/analytics";

interface TrackedButtonProps extends ButtonProps {
  /** Stable snake_case id reported as `cta_id` on `cta_clicked`. */
  ctaId: string;
  ctaPosition?: CtaPosition;
  /** Overrides the visible text as `cta_label` (e.g. icon-only buttons). */
  ctaLabel?: string;
}

/** `Button` that reports `cta_clicked`; use it for every primary/secondary CTA. */
export const TrackedButton = forwardRef<HTMLButtonElement, TrackedButtonProps>(
  ({ ctaId, ctaPosition, ctaLabel, ...props }, ref) => (
    <Button ref={ref} {...ctaProps(ctaId, ctaPosition, ctaLabel)} {...props} />
  ),
);
TrackedButton.displayName = "TrackedButton";
