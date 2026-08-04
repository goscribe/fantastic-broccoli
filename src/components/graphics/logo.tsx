import Image from 'next/image';

export function ScribeMark({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
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
