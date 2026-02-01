import { X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PainPointCardProps {
  text: string;
  delay?: number;
}

export function PainPointCard({ text, delay = 0 }: PainPointCardProps) {
  return (
    <Card
      variant="glass"
      className="animate-fade-in border-destructive/20"
      style={{ animationDelay: `${delay}s` }}
    >
      <CardContent className="pt-6 flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
          <X className="h-3 w-3 text-destructive" />
        </div>
        <span className="text-sm text-muted-foreground">{text}</span>
      </CardContent>
    </Card>
  );
}
