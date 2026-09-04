import { cn } from "@/lib/utils";

interface ScoreDisplayProps {
  score: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function ScoreDisplay({ score, size = "md", className }: ScoreDisplayProps) {
  return (
    <div className={cn("flex items-baseline gap-1", className)}>
      <span
        className={cn(
          "data-value font-bold tracking-[-0.035em] text-accent",
          size === "sm" && "text-lg",
          size === "md" && "text-2xl",
          size === "lg" && "text-4xl"
        )}
      >
        {score.toFixed(1)}
      </span>
      <span className={cn("font-mono text-brown-light", size === "sm" ? "text-[9px]" : "text-[10px]")}>
        /10
      </span>
    </div>
  );
}
