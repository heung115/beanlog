"use client";

interface ScoreSliderProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

export function ScoreSlider({ value, onChange, label }: ScoreSliderProps) {
  const pct = ((value - 1) / 9) * 100;

  return (
    <div className="flex flex-col gap-3">
      {label && (
        <span className="text-sm font-medium text-brown-medium">{label}</span>
      )}

      <div className="flex items-center gap-5">
        <div className="flex shrink-0 items-baseline gap-1">
          <span
            key={value}
            className="data-value animate-rise inline-block min-w-[3ch] text-center text-5xl font-bold tracking-[-0.035em] text-brown"
          >
            {value % 1 === 0 ? value : value.toFixed(1)}
          </span>
          <span className="text-sm text-brown-light">/10</span>
        </div>

        <div className="flex flex-1 flex-col gap-1.5">
          <input
            type="range"
            min={1}
            max={10}
            step={0.5}
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            className="slider-brown"
            aria-label={label ?? "score"}
            style={{
              background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-border) ${pct}%)`,
            }}
          />
          <div className="flex justify-between text-[10px] font-medium tabular-nums text-brown-light">
            <span>1</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>
      </div>
    </div>
  );
}
