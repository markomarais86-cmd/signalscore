import { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface FeatureCardProps {
  icon?: LucideIcon;
  iconUrl?: string;
  title: string;
  description: string;
  delay?: number;
}

export function FeatureCard({ icon: Icon, iconUrl, title, description, delay = 0 }: FeatureCardProps) {
  return (
    <Card
      variant="glass"
      hover="lift"
      className="animate-fade-in"
      style={{ animationDelay: `${delay}s` }}
    >
      <CardHeader className="pb-4">
        <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/20 overflow-hidden">
          {iconUrl ? (
            <img src={iconUrl} alt={title} className="w-10 h-10 object-contain" />
          ) : Icon ? (
            <Icon className="h-7 w-7 text-primary" />
          ) : null}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-white/60 text-base leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}
