import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  /** Optional gradient effect for the title */
  gradient?: boolean;
}

/**
 * Standardized page header component for consistent styling across all pages.
 * 
 * @example
 * <PageHeader 
 *   title="Settings" 
 *   description="Manage your account and preferences"
 * >
 *   <Button>Save Changes</Button>
 * </PageHeader>
 */
export function PageHeader({ 
  title, 
  description, 
  children, 
  className,
  gradient = false 
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="space-y-1">
        <h1 
          className={cn(
            "text-3xl font-bold tracking-tight",
            gradient && "bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm sm:text-base">
            {description}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
