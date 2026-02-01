import { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon?: LucideIcon;
  iconUrl?: string;
  title: string;
  description: string;
  delay?: number;
}

export function FeatureCard({ icon: Icon, iconUrl, title, description, delay = 0 }: FeatureCardProps) {
  // Split title for styling - all but last word green, last word white
  const words = title.split(' ');
  const greenPart = words.slice(0, -1).join(' ');
  const whitePart = words[words.length - 1];
  
  return (
    <div
      className="p-6 rounded-xl border border-white/10 bg-[#1F2227] animate-fade-in"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/20 overflow-hidden">
        {iconUrl ? (
          <img src={iconUrl} alt={title} className="w-10 h-10 object-contain" />
        ) : Icon ? (
          <Icon className="h-7 w-7 text-primary" />
        ) : null}
      </div>
      <h3 className="text-xl font-semibold mb-3">
        {greenPart && <span className="text-primary">{greenPart} </span>}
        <span className="text-white">{whitePart}</span>
      </h3>
      <p className="text-white/60 text-base leading-relaxed">
        {description}
      </p>
    </div>
  );
}
