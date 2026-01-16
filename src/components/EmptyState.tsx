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
    <Card className="shadow-sm hover:shadow-md transition-shadow">
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
      {actionLabel && onAction && (
        <CardContent className="flex justify-center pb-8">
          <Button onClick={onAction}>{actionLabel}</Button>
        </CardContent>
      )}
    </Card>
  );
}
