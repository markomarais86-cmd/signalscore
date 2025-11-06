import { Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InfiniteScrollTriggerProps {
  observerTarget: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore?: () => void;
  onRetry?: () => void;
  error?: Error | null;
  itemsCount?: number;
  totalCount?: number;
}

/**
 * Visual trigger component for infinite scroll
 * Shows loading spinner, load more button, retry button, or end message
 */
export function InfiniteScrollTrigger({
  observerTarget,
  isLoading,
  hasMore,
  onLoadMore,
  onRetry,
  error,
  itemsCount,
  totalCount,
}: InfiniteScrollTriggerProps) {
  return (
    <div
      ref={observerTarget}
      className="flex flex-col items-center justify-center py-8 gap-4"
    >
      {/* Error State with Retry */}
      {error && onRetry && (
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span className="flex-1">Failed to load data. Please try again.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="shrink-0"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {isLoading && !error && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading more...</span>
        </div>
      )}

      {/* Load More Button */}
      {!isLoading && hasMore && onLoadMore && !error && (
        <div className="flex flex-col items-center gap-2">
          {itemsCount && totalCount && (
            <p className="text-sm text-muted-foreground">
              Showing {itemsCount.toLocaleString()} of {totalCount.toLocaleString()} items
            </p>
          )}
          <Button
            variant="outline"
            onClick={onLoadMore}
            className="min-w-[200px]"
          >
            Load More
          </Button>
        </div>
      )}

      {/* End of List Message */}
      {!isLoading && !hasMore && itemsCount && itemsCount > 0 && !error && (
        <div className="text-sm text-muted-foreground">
          {totalCount ? (
            <p>Showing all {totalCount.toLocaleString()} items</p>
          ) : (
            <p>No more items to load</p>
          )}
        </div>
      )}
    </div>
  );
}
