import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <Card>
      <CardHeader className="text-center">
        {Icon && (
          <div className="flex justify-center mb-4">
            <Icon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {actionLabel && onAction && (
        <CardContent className="flex justify-center">
          <Button onClick={onAction}>{actionLabel}</Button>
        </CardContent>
      )}
    </Card>
  );
}
