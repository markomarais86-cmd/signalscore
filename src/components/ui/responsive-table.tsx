import { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A wrapper that shows children as a standard <Table> on desktop
 * and converts rows into stacked cards on mobile (< sm breakpoint).
 *
 * Usage:
 *   <ResponsiveTable
 *     headers={["Name","Industry","Score"]}
 *     rows={data}
 *     renderRow={(item) => [item.name, item.industry, item.score]}
 *     renderCard={(item) => <MyMobileCard item={item} />}
 *     onRowClick={(item) => select(item)}
 *   />
 */

interface ResponsiveTableProps<T> {
  headers: string[];
  rows: T[];
  renderRow: (item: T, index: number) => ReactNode[];
  renderCard: (item: T, index: number) => ReactNode;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  className?: string;
  keyExtractor?: (item: T, index: number) => string;
}

export function ResponsiveTable<T>({
  headers,
  rows,
  renderRow,
  renderCard,
  onRowClick,
  emptyMessage = "No data available.",
  className,
  keyExtractor,
}: ResponsiveTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">{emptyMessage}</div>
    );
  }

  return (
    <div className={className}>
      {/* Mobile cards */}
      <div className="block sm:hidden space-y-3" role="list">
        {rows.map((item, idx) => (
          <div
            key={keyExtractor ? keyExtractor(item, idx) : idx}
            role="listitem"
            className={cn(
              "border rounded-lg p-3 bg-card",
              onRowClick && "cursor-pointer hover:bg-muted/50 transition-colors"
            )}
            onClick={() => onRowClick?.(item)}
            tabIndex={onRowClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onRowClick(item);
              }
            }}
          >
            {renderCard(item, idx)}
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <table className="hidden sm:table w-full caption-bottom text-sm">
        <thead className="[&_tr]:border-b">
          <tr className="border-b transition-colors hover:bg-muted/50">
            {headers.map((h) => (
              <th
                key={h}
                className="h-10 px-2 text-left align-middle font-medium text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&_tr:last-child]:border-0">
          {rows.map((item, idx) => {
            const cells = renderRow(item, idx);
            return (
              <tr
                key={keyExtractor ? keyExtractor(item, idx) : idx}
                className={cn(
                  "border-b transition-colors hover:bg-muted/50",
                  onRowClick && "cursor-pointer"
                )}
                onClick={() => onRowClick?.(item)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onRowClick(item);
                  }
                }}
              >
                {cells.map((cell, ci) => (
                  <td key={ci} className="p-2 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
