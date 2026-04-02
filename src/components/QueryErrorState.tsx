import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface QueryErrorStateProps {
  error: Error | null;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}

/**
 * A user-friendly error state for failed data fetches.
 * Shows contextual messaging and a retry button.
 */
export function QueryErrorState({
  error,
  onRetry,
  title = "Something went wrong",
  compact = false,
}: QueryErrorStateProps) {
  const isNetworkError =
    error?.message?.includes("Failed to fetch") ||
    error?.message?.includes("NetworkError") ||
    error?.message?.includes("net::ERR");

  const Icon = isNetworkError ? WifiOff : AlertCircle;
  const description = isNetworkError
    ? "Please check your internet connection and try again."
    : error?.message || "An unexpected error occurred while loading data.";

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg border border-destructive/30 bg-destructive/5">
        <Icon className="h-5 w-5 text-destructive shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0">
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="border-destructive/30">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-destructive/10 p-3 mb-4">
          <Icon className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
        {onRetry && (
          <Button variant="outline" onClick={onRetry}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try again
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
