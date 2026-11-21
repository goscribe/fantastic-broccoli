"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import Image from "next/image";

/**
 * A page crashed while rendering. Replaces the framework's default screen
 * (system font, black "Reload" button) with Scribe's own: the cat, what
 * happened in plain words, and one way to carry on.
 */
export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70dvh] flex-1 flex-col items-center justify-center px-4 py-16 text-center" role="alert">
      <Image src="/design/cat3-think.webp" alt="" width={383} height={400} unoptimized className="h-[112px] w-auto select-none" />
      <h1 className="page-h1 mt-5">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-[15px] leading-relaxed text-muted-foreground">
        This page hit a problem. Your work is saved. Try again, or head back home.
      </p>
      <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
        <Button onClick={() => unstable_retry()}>Try again</Button>
        <Link href="/" className={buttonClass({ variant: "secondary" })}>
          Back to home
        </Link>
      </div>
      {error.digest && <p className="mt-6 text-[12px] text-faint">Error reference: {error.digest}</p>}
    </div>
  );
}
