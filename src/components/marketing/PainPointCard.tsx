import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PainPointCardProps {
  text: string;
  delay?: number;
}

export function PainPointCard({ text, delay = 0 }: PainPointCardProps) {
  return (
    <Card
      variant="glass"
      className="animate-fade-in border-border/30"
      style={{ animationDelay: `${delay}s` }}
    >
      <CardContent className="pt-6 flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Check className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-sm text-muted-foreground leading-relaxed">{text}</span>
      </CardContent>
    </Card>
  );
}
