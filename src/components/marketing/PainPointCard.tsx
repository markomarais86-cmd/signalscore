import { Check } from "lucide-react";

interface PainPointCardProps {
  text: string;
  delay?: number;
}

export function PainPointCard({ text, delay = 0 }: PainPointCardProps) {
  return (
    <div
      className="flex items-start gap-3 animate-fade-in"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
        <Check className="h-4 w-4 text-black" />
      </div>
      <span className="text-white/80 text-sm leading-relaxed">{text}</span>
    </div>
  );
}
