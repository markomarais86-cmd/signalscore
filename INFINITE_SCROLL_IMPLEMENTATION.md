# Infinite Scroll & Cursor-Based Pagination Implementation

## Overview

This implementation provides progressive data loading with infinite scroll functionality using cursor-based pagination. This approach is more efficient than offset-based pagination for large datasets.

## Benefits

✅ **Better Performance**: Cursor-based pagination doesn't require counting or skipping records
✅ **Scalability**: Works efficiently with millions of records
✅ **Real-time Safe**: Handles concurrent data changes better than offset-based pagination
✅ **Smooth UX**: Automatic loading as user scrolls, with optional "Load More" button
✅ **Type-Safe**: Full TypeScript support with proper typing

## Architecture

### Core Components

1. **`use-cursor-pagination.tsx`** - Base hook for managing pagination state
2. **`use-infinite-scroll.tsx`** - Hook using Intersection Observer API for scroll detection
3. **`InfiniteScrollTrigger.tsx`** - Visual component for loading states
4. **`use-infinite-accounts.tsx`** - Specialized hook for accounts data
5. **`use-infinite-leads.tsx`** - Specialized hook for leads data

## How It Works

### Cursor-Based Pagination

Instead of using `OFFSET` and `LIMIT`:
```sql
-- ❌ Old way (offset-based)
SELECT * FROM accounts LIMIT 25 OFFSET 50;
-- Gets slower as offset increases
```

We use cursors based on a sortable column:
```sql
-- ✅ New way (cursor-based)
SELECT * FROM accounts 
WHERE updated_at < '2024-01-15T10:30:00Z'
ORDER BY updated_at DESC
LIMIT 25;
-- Always fast, regardless of position
```

### Infinite Scroll Detection

Uses the Intersection Observer API to detect when user scrolls near the bottom:

```typescript
const observer = new IntersectionObserver(
  (entries) => {
    if (entries[0].isIntersecting && hasMore && !isLoading) {
      loadMore(); // Load next page
    }
  },
  { rootMargin: '100px' } // Trigger 100px before reaching element
);
```

## Usage Examples

### Basic Account List with Infinite Scroll

```typescript
import { useInfiniteAccounts } from '@/hooks/use-infinite-accounts';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { InfiniteScrollTrigger } from '@/components/InfiniteScrollTrigger';

export function AccountsList() {
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  
  const {
    accounts,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    loadMore,
    refresh,
  } = useInfiniteAccounts({
    orgId: userProfile?.org_id || null,
    pageSize: 25,
    searchTerm,
    enabled: !!userProfile?.org_id,
  });

  const { observerTarget } = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: isLoadingMore,
    rootMargin: '200px', // Load more when 200px from bottom
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div>
      <Input
        placeholder="Search accounts..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />
      
      <div className="space-y-4">
        {accounts.map((account) => (
          <AccountCard key={account.id} account={account} />
        ))}
      </div>

      <InfiniteScrollTrigger
        observerTarget={observerTarget}
        isLoading={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
        itemsCount={accounts.length}
        totalCount={totalCount}
      />
    </div>
  );
}
```

### With Filters

```typescript
const {
  accounts,
  isLoading,
  hasMore,
  loadMore,
} = useInfiniteAccounts({
  orgId: userProfile?.org_id || null,
  pageSize: 50, // Load 50 at a time
  searchTerm,
  industryFilter: 'Technology',
  sourceFilter: 'crm',
  countryFilter: 'United States',
});
```

### Manual Load More Button

```typescript
<InfiniteScrollTrigger
  observerTarget={observerTarget}
  isLoading={isLoadingMore}
  hasMore={hasMore}
  onLoadMore={loadMore} // Shows button when provided
  itemsCount={accounts.length}
  totalCount={totalCount}
/>
```

### Auto-Load Only (No Button)

```typescript
<InfiniteScrollTrigger
  observerTarget={observerTarget}
  isLoading={isLoadingMore}
  hasMore={hasMore}
  // onLoadMore not provided = auto-load only
  itemsCount={accounts.length}
  totalCount={totalCount}
/>
```

## Integration into Existing Pages

### Step 1: Import the Hooks

```typescript
import { useInfiniteAccounts } from '@/hooks/use-infinite-accounts';
import { useInfiniteScroll } from '@/hooks/use-infinite-scroll';
import { InfiniteScrollTrigger } from '@/components/InfiniteScrollTrigger';
```

### Step 2: Replace Existing Data Hook

```typescript
// ❌ Old way
const [accounts, setAccounts] = useState([]);
const [loading, setLoading] = useState(true);
const [currentPage, setCurrentPage] = useState(1);

// ✅ New way
const {
  accounts,
  isLoading,
  isLoadingMore,
  hasMore,
  totalCount,
  loadMore,
  refresh,
} = useInfiniteAccounts({
  orgId: userProfile?.org_id || null,
  searchTerm,
  industryFilter,
  sourceFilter,
});
```

### Step 3: Add Infinite Scroll

```typescript
const { observerTarget } = useInfiniteScroll({
  onLoadMore: loadMore,
  hasMore,
  isLoading: isLoadingMore,
});
```

### Step 4: Update JSX

```typescript
// Remove pagination controls
// ❌ <PaginationControls currentPage={currentPage} ... />

// Add infinite scroll trigger at the end of the list
<InfiniteScrollTrigger
  observerTarget={observerTarget}
  isLoading={isLoadingMore}
  hasMore={hasMore}
  onLoadMore={loadMore}
  itemsCount={accounts.length}
  totalCount={totalCount}
/>
```

## Performance Considerations

### Debouncing Search

For search inputs, consider debouncing to reduce queries:

```typescript
import { useState, useEffect } from 'react';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

const [searchInput, setSearchInput] = useState('');
const debouncedSearch = useDebouncedValue(searchInput, 300);

const { accounts } = useInfiniteAccounts({
  orgId: userProfile?.org_id || null,
  searchTerm: debouncedSearch, // Use debounced value
});
```

### Virtualization for Very Large Lists

For lists with thousands of visible items, consider adding virtualization:

```bash
npm install react-virtual
```

```typescript
import { useVirtual } from 'react-virtual';

const parentRef = useRef<HTMLDivElement>(null);
const rowVirtualizer = useVirtual({
  size: accounts.length,
  parentRef,
  estimateSize: useCallback(() => 80, []),
});
```

## Testing

### Test Infinite Loading

```typescript
// 1. Scroll to bottom rapidly
// 2. Verify loadMore is called only once at a time
// 3. Confirm no duplicate items in list
// 4. Check that cursor advances properly
```

### Test Filters

```typescript
// 1. Apply filter
// 2. Verify data resets (pagination.reset())
// 3. Load more pages
// 4. Change filter
// 5. Verify list resets again
```

### Test Error Handling

```typescript
// 1. Disconnect network
// 2. Scroll to trigger load
// 3. Verify error toast appears
// 4. Reconnect network
// 5. Verify retry works
```

## API Response Format

The hooks expect Supabase queries to return:

```typescript
{
  data: Account[], // Array of items
  count: number,   // Total count (for "X of Y items")
  error: Error | null
}
```

## Cursor Column Requirements

For cursor-based pagination to work, the cursor column must be:

1. **Indexed** - For fast queries
2. **Sortable** - Ordered values (timestamp, ID, etc.)
3. **Unique or nearly unique** - To avoid pagination issues
4. **Immutable** - Value doesn't change after creation

Good cursor columns:
- ✅ `created_at` (timestamp)
- ✅ `updated_at` (timestamp) 
- ✅ `id` (auto-increment or UUID with timestamp)

Bad cursor columns:
- ❌ `name` (can have duplicates, changes)
- ❌ `score` (changes frequently)

## Troubleshooting

### Issue: Infinite load loop

**Cause**: `hasMore` not updating correctly
**Fix**: Ensure `setHasMore(items.length === pageSize)` is called

### Issue: Duplicate items appearing

**Cause**: Cursor not advancing
**Fix**: Verify cursor column is properly set from last item

### Issue: Slow queries

**Cause**: Missing database index on cursor column
**Fix**: Add index:

```sql
CREATE INDEX idx_accounts_updated_at ON accounts(org_id, updated_at DESC);
```

### Issue: Items appear out of order

**Cause**: Concurrent updates during pagination
**Solution**: This is expected with cursor pagination. Use `refresh()` to reload if needed.

## Migration Path

### Phase 1: Add Alongside Existing (Recommended)

1. Keep existing pagination
2. Add infinite scroll as optional mode
3. A/B test with users
4. Gather feedback

### Phase 2: Make Default

1. Make infinite scroll the default
2. Keep pagination as fallback
3. Add user preference setting

### Phase 3: Remove Old Pagination

1. Remove offset-based code
2. Clean up unused components
3. Update tests

## Future Enhancements

- [ ] Bidirectional scrolling (load previous pages)
- [ ] Jump to page functionality
- [ ] Save scroll position on navigation
- [ ] Prefetch next page in background
- [ ] Optimistic updates for real-time data
- [ ] Virtual scrolling integration
- [ ] Export visible items only
- [ ] Smart caching strategy

## Resources

- [Intersection Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API)
- [Cursor Pagination Best Practices](https://www.citusdata.com/blog/2016/03/30/five-ways-to-paginate/)
- [React Virtual](https://github.com/TanStack/virtual)
