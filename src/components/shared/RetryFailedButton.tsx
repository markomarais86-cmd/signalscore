import { Button } from "@/components/ui/button";
import { RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RetryFailedButtonProps {
  failedCount: number;
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  showCount?: boolean;
  label?: string;
}

/**
 * Reusable button for retrying failed operations in bulk jobs.
 * Only renders when there are failed records to retry.
 */
export function RetryFailedButton({
  failedCount,
  onRetry,
  isRetrying = false,
  className,
  size = "sm",
  variant = "destructive",
  showCount = true,
  label = "Retry Failed",
}: RetryFailedButtonProps) {
  // Don't render if there are no failures
  if (failedCount <= 0) {
    return null;
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={onRetry}
      disabled={isRetrying}
      className={cn("gap-2", className)}
    >
      {isRetrying ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Retrying...
        </>
      ) : (
        <>
          <RotateCcw className="h-4 w-4" />
          {label}
          {showCount && (
            <span className="font-bold">({failedCount.toLocaleString()})</span>
          )}
        </>
      )}
    </Button>
  );
}