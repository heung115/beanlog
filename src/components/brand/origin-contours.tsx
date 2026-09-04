import { cn } from "@/lib/utils";

export function OriginContours({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 680 560"
      fill="none"
      className={cn("text-accent", className)}
    >
      <path d="M111 395c-56-65-43-171 28-219 59-40 120-12 175-62 52-48 143-40 193 8 44 43 27 91 75 135 48 45 34 132-22 172-54 38-112 3-173 32-88 42-211 14-276-66Z" stroke="currentColor" strokeWidth="1.3" opacity=".22" />
      <path d="M139 379c-44-54-33-139 27-178 50-33 105-9 150-52 44-42 118-34 161 8 37 36 21 80 64 116 39 34 29 101-18 134-47 33-99 2-151 27-75 36-178 12-233-55Z" stroke="currentColor" strokeWidth="1.3" opacity=".32" />
      <path d="M174 358c-34-43-24-108 25-139 40-26 84-6 120-40 35-34 94-26 127 7 29 29 17 63 51 93 31 27 23 79-15 105-37 26-79 1-120 21-59 29-145 10-188-47Z" stroke="currentColor" strokeWidth="1.3" opacity=".46" />
      <path d="M211 337c-24-31-17-79 18-102 30-20 62-4 89-30 26-25 69-19 93 6 22 21 12 46 38 68 22 20 16 58-11 77-28 19-58 0-89 15-43 21-106 7-138-34Z" stroke="currentColor" strokeWidth="1.3" opacity=".62" />
      <path d="M252 314c-14-19-10-49 12-63 18-12 38-2 55-18 16-16 43-12 58 3 13 14 7 29 23 43 14 12 10 36-7 48-17 12-36 0-55 9-27 13-66 4-86-22Z" stroke="currentColor" strokeWidth="1.3" opacity=".82" />
      <path d="m281 293 21-25 30 5 11 27-20 23-29-5-13-25Z" fill="currentColor" opacity=".09" />
      <circle cx="309" cy="294" r="5.5" fill="currentColor" />
      <path d="M309 294 481 147M309 294l145 115M309 294 144 226" stroke="currentColor" strokeWidth="1" strokeDasharray="3 7" opacity=".5" />
      <circle cx="481" cy="147" r="3" fill="currentColor" />
      <circle cx="454" cy="409" r="3" fill="currentColor" />
      <circle cx="144" cy="226" r="3" fill="currentColor" />
    </svg>
  );
}
