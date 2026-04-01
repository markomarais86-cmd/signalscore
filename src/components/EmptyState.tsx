import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Optional secondary action */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Visual variant */
  variant?: "default" | "minimal" | "onboarding";
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  variant = "default",
  className,
}: EmptyStateProps) {
  if (variant === "minimal") {
    return (
      <div className={cn("text-center py-12", className)}>
        {Icon && (
          <div className="flex justify-center mb-3">
            <Icon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        <p className="text-sm font-medium text-foreground mb-1">{title}</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">{description}</p>
        {actionLabel && onAction && (
          <Button size="sm" onClick={onAction}>{actionLabel}</Button>
        )}
      </div>
    );
  }

  if (variant === "onboarding") {
    return (
      <Card className={cn("border-primary/20 bg-primary/[0.02] shadow-sm", className)}>
        <CardHeader className="text-center pb-2">
          {Icon && (
            <div className="flex justify-center mb-3">
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
                <Icon className="h-8 w-8 text-primary" />
              </div>
            </div>
          )}
          <CardTitle className="text-lg">{title}</CardTitle>
          <CardDescription className="mt-1 max-w-md mx-auto">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3 pb-8">
          {actionLabel && onAction && (
            <Button onClick={onAction}>{actionLabel}</Button>
          )}
          {secondaryLabel && onSecondary && (
            <Button variant="outline" onClick={onSecondary}>{secondaryLabel}</Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardHeader className="text-center py-12">
        {Icon && (
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-muted">
              <Icon className="h-10 w-10 text-muted-foreground" />
            </div>
          </div>
        )}
        <CardTitle>{title}</CardTitle>
        <CardDescription className="mt-2">{description}</CardDescription>
      </CardHeader>
      {(actionLabel && onAction) && (
        <CardContent className="flex justify-center gap-3 pb-8">
          <Button onClick={onAction}>{actionLabel}</Button>
          {secondaryLabel && onSecondary && (
            <Button variant="outline" onClick={onSecondary}>{secondaryLabel}</Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
