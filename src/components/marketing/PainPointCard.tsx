import { CheckCircle } from "lucide-react";

interface PainPointCardProps {
  text: string;
  delay?: number;
}

export function PainPointCard({ text, delay = 0 }: PainPointCardProps) {
  // Split text at first comma to style differently (white part, gray part)
  const commaIndex = text.indexOf(',');
  const boldPart = commaIndex > -1 ? text.slice(0, commaIndex) : text;
  const grayPart = commaIndex > -1 ? text.slice(commaIndex) : '';
  
  return (
    <div
      className="flex items-start gap-3 animate-fade-in"
      style={{ animationDelay: `${delay}s` }}
    >
      <CheckCircle className="h-6 w-6 text-primary flex-shrink-0 mt-0.5" />
      <span className="text-base leading-relaxed">
        <span className="text-white">{boldPart}</span>
        <span className="text-white/50">{grayPart}</span>
      </span>
    </div>
  );
}
