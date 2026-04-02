import { DashboardSkeleton } from "@/components/DashboardSkeleton";
import { TableSkeleton } from "@/components/TableSkeleton";
import { SettingsSkeleton } from "@/components/SettingsSkeleton";

interface PageSuspenseFallbackProps {
  variant?: "dashboard" | "table" | "settings" | "minimal";
}

/**
 * Context-aware loading skeleton for Suspense fallbacks.
 * Use the variant that best matches the page being loaded.
 */
export function PageSuspenseFallback({ variant = "minimal" }: PageSuspenseFallbackProps) {
  switch (variant) {
    case "dashboard":
      return <DashboardSkeleton />;
    case "table":
      return <TableSkeleton rows={8} columns={5} />;
    case "settings":
      return <SettingsSkeleton />;
    case "minimal":
    default:
      return (
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <p className="text-sm text-muted-foreground animate-pulse">Loading…</p>
          </div>
        </div>
      );
  }
}
