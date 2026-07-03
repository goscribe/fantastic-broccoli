import { WorkspaceMember } from "@/types";
import { cn } from "@/lib/utils";

export function AvatarStack({
  members,
  max = 4,
  size = "sm",
  className,
}: {
  members: WorkspaceMember[];
  max?: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;
  const sizeClasses =
    size === "sm" ? "h-5 w-5 text-[9px]" : "h-7 w-7 text-[11px]";

  return (
    <div className={cn("flex items-center -space-x-1.5", className)}>
      {shown.map((member) => (
        <span
          key={member.id}
          title={member.name}
          className={cn(
            "flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-card",
            sizeClasses,
          )}
          style={{ backgroundColor: member.color }}
        >
          {member.name.charAt(0).toUpperCase()}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            "flex items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground ring-2 ring-card",
            sizeClasses,
          )}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
