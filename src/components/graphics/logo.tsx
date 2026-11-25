import Image from 'next/image';

/**
 * The Scribe mark, small form: the mascot cat's head wearing the purple
 * headphones. For square slots under ~32 px (sidebar, menu button), where the
 * full-body cat's face is too small to read. Favicons and app icons have
 * their own files (src/app/icon*, favicon.ico, public/icons/hp-*).
 */
export function ScribeMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/scribe-hp-head.svg"
      width={64}
      height={64}
      alt="Scribe logo"
      className={className}
    />
  );
}

/**
 * The full-body waving cat with purple headphones (the live cat3 "wave" art).
 * For the lockup and anywhere with room for it (about 40 px tall or more).
 */
export function ScribeBodyMark({ className, alt = "Scribe logo" }: { className?: string; alt?: string }) {
  return (
    <Image
      src="/brand/scribe-hp-body.svg"
      width={91}
      height={106}
      alt={alt}
      className={className}
    />
  );
}

export function ScribeLogo({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""} hover:cursor-pointer`}>
      <ScribeBodyMark className="h-10 w-auto" alt="" />
      <span className="text-sm font-bold tracking-tight">Scribe</span>
    </span>
  );
}
