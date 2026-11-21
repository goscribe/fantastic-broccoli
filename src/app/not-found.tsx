import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import Image from "next/image";
import { ScribeLogo } from "@/components/graphics/logo";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <Link href="/" aria-label="Scribe home" className="inline-block">
          <ScribeLogo className="justify-center" />
        </Link>
        <Image src="/design/cat3-think.webp" alt="" width={383} height={400} unoptimized className="mx-auto h-[104px] w-auto select-none" />
        <div className="space-y-1.5">
          <h1 className="page-h1">Page not found</h1>
          <p className="text-[15px] text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or may have
            moved.
          </p>
        </div>
        <Link href="/" className={buttonClass()}>
          Back to home
        </Link>
      </div>
    </div>
  );
}
