import Image from 'next/image';

/**
 * The Scribe mark: the mascot cat's head (cat3). A vector traced from the
 * generated art with a slightly heavier outline so it holds up at 20–32 px.
 * Favicons and app icons have their own small-size drawings (src/app/icon*,
 * favicon.ico, public/icons/cat-*).
 */
export function ScribeMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/scribe-mark.svg"
      width={64}
      height={64}
      alt="Scribe logo"
      className={className}
    />
  );
}

export function ScribeLogo({ className }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 ${className ?? ""} hover:cursor-pointer`}>
      <ScribeMark className="h-[26px] w-[26px]" />
      <span className="text-sm font-bold tracking-tight">Scribe</span>
    </span>
  );
}
