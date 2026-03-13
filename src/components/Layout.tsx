import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HelpPanel } from "@/components/help/HelpPanel";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { ExportQueueManager } from "@/components/ExportQueueManager";
import { AIChat } from "@/components/AIChat";
import { CampaignBuilderV2 } from "@/components/campaigns/CampaignBuilderV2";
import { useCampaignContext } from "@/hooks/use-campaign-context";

import { GlobalCommandPalette, CommandPaletteTrigger } from "@/components/GlobalCommandPalette";
import { OrgSwitcher, ImpersonationBanner } from "@/components/OrgSwitcher";
import { GlobalAIAssistant } from "@/components/GlobalAIAssistant";
import { useNotificationDispatcher } from "@/hooks/use-notification-dispatcher";
import { FeatureErrorBoundary } from "@/components/FeatureErrorBoundary";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { isCampaignBuilderOpen, closeCampaignBuilder, insightContext } = useCampaignContext();
  useNotificationDispatcher();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="relative z-20 border-b bg-card/80 dark:bg-card/60 backdrop-blur-sm shadow-sm">
            <div className="h-14 flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
                <CommandPaletteTrigger />
                <OrgSwitcher />
              </div>
              <div className="flex items-center gap-2">
                <ExportQueueManager />
                <NotificationCenter />
                <HelpPanel currentPath={location.pathname} />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <ImpersonationBanner />
          <div className="flex-1 p-2 sm:p-3 lg:p-4 overflow-auto">
            {children}
          </div>
          <footer className="border-t bg-card/80 dark:bg-card/60 backdrop-blur-sm px-6 py-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>© 2025 LaunchPulse. All rights reserved.</span>
              <button className="hover:text-primary transition-colors font-medium">
                Consulting Services
              </button>
            </div>
          </footer>
        </main>
        <AIChat />
        
        {/* Global Command Palette - accessible from any page via Cmd+K */}
        <GlobalCommandPalette />
        
        {/* Global AI Assistant - accessible from any page via Cmd+J */}
        <GlobalAIAssistant />
        
        {/* Global Campaign Builder - triggered from insights */}
        <CampaignBuilderV2
          isOpen={isCampaignBuilderOpen}
          onClose={closeCampaignBuilder}
          source="insight"
          insightContext={insightContext || undefined}
        />
      </div>
    </SidebarProvider>
  );
}