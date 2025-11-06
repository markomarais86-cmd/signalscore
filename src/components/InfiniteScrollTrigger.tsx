import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InfiniteScrollTriggerProps {
  observerTarget: React.RefObject<HTMLDivElement>;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore?: () => void;
  itemsCount?: number;
  totalCount?: number;
}

/**
 * Visual trigger component for infinite scroll
 * Shows loading spinner, load more button, or end message
 */
export function InfiniteScrollTrigger({
  observerTarget,
  isLoading,
  hasMore,
  onLoadMore,
  itemsCount,
  totalCount,
}: InfiniteScrollTriggerProps) {
  return (
    <div
      ref={observerTarget}
      className="flex flex-col items-center justify-center py-8 gap-4"
    >
      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading more...</span>
        </div>
      )}

      {!isLoading && hasMore && onLoadMore && (
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

      {!isLoading && !hasMore && itemsCount && itemsCount > 0 && (
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
