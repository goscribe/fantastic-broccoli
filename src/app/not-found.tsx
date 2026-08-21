import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ScribeLogo } from "@/components/graphics/logo";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <Link href="/" aria-label="Scribe home" className="inline-block">
          <ScribeLogo className="justify-center" />
        </Link>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-widest text-faint">
            404
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have
            moved.
          </p>
        </div>
        <Link href="/" className="inline-block">
          <Button size="md" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Button>
        </Link>
      </div>
    </div>
  );
}
