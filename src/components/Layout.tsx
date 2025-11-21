import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HelpPanel } from "@/components/help/HelpPanel";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="relative z-20 border-b bg-card shadow-sm">
            <div className="h-14 flex items-center justify-between px-6">
              <div className="flex items-center gap-4">
                <SidebarTrigger />
              </div>
              <div className="flex items-center gap-2">
                <HelpPanel />
                <ThemeToggle />
              </div>
            </div>
          </header>
          <div className="flex-1 p-2 sm:p-3 lg:p-4 overflow-auto bg-muted/20">
            {children}
          </div>
          <footer className="border-t bg-card px-6 py-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>© 2025 LaunchPulse. All rights reserved.</span>
              <button className="hover:text-primary transition-colors font-medium">
                Consulting Services
              </button>
            </div>
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}