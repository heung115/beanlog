import { cn } from "@/lib/utils";

interface ScoreDisplayProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreDisplay({ score, size = "md", className }: ScoreDisplayProps) {
  return (
    <div className={cn("flex items-baseline gap-0.5", className)}>
      <span
        className={cn(
          "font-display font-bold text-brown",
          size === "sm" && "text-lg",
          size === "md" && "text-2xl",
          size === "lg" && "text-4xl"
        )}
      >
        {score.toFixed(1)}
      </span>
      <span className={cn("text-brown-light/50", size === "sm" ? "text-[10px]" : "text-xs")}>
        /10
      </span>
    </div>
  );
}
