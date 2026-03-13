import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CustomerSidebar } from "@/components/CustomerSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ManagedUpgradeBanner } from "@/components/ManagedUpgradeBanner";
import { useBrandedConfig } from "@/hooks/useBrandedConfig";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { useServiceType } from "@/hooks/use-service-type";
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary";

interface CustomerLayoutProps {
  children: ReactNode;
}

export function CustomerLayout({ children }: CustomerLayoutProps) {
  const { effectiveOrgId } = useEffectiveOrg();
  const { isManaged } = useServiceType();
  const { data: brandConfig } = useBrandedConfig({ orgId: effectiveOrgId || undefined });

  const brandStyles = brandConfig?.brand_primary_color
    ? { "--brand-primary": brandConfig.brand_primary_color } as React.CSSProperties
    : undefined;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background" style={brandStyles}>
        <CustomerSidebar />
        <main className="flex-1 flex flex-col">
          <header className="relative z-20 border-b bg-card/80 dark:bg-card/60 backdrop-blur-sm shadow-sm">
            <div className="h-14 flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
              </div>
              <div className="flex items-center gap-2">
                <NotificationCenter />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <div className="flex-1 p-2 sm:p-3 lg:p-4 overflow-auto space-y-4">
            {isManaged && <ManagedUpgradeBanner />}
            {children}
          </div>
          <footer className="border-t bg-card/80 dark:bg-card/60 backdrop-blur-sm px-6 py-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>© 2025 LaunchPulse. All rights reserved.</span>
            </div>
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}
