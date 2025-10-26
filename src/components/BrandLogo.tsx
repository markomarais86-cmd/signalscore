import { cn } from "@/lib/utils";

interface BrandLogoProps {
  variant?: "light" | "dark";
  className?: string;
  showTagline?: boolean;
}

export function BrandLogo({ 
  variant = "light", 
  className,
  showTagline = false 
}: BrandLogoProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <div className={cn(
        "text-2xl font-bold font-heading tracking-tight",
        variant === "light" ? "text-foreground" : "text-background"
      )}>
        <span className={cn(
          "font-heading font-semibold",
          variant === "light" ? "text-primary" : "text-primary"
        )}>Launch</span>
        <span className={cn(
          variant === "light" ? "text-foreground" : "text-background"
        )}>Pulse</span>
      </div>
      {showTagline && (
        <p className={cn(
          "text-xs mt-0.5",
          variant === "light" ? "text-muted-foreground" : "text-muted"
        )}>
          Where GTM Meets ICP Precision
        </p>
      )}
    </div>
  );
}
