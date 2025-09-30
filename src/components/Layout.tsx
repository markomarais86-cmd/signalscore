import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { WorkflowStepper } from "@/components/WorkflowStepper";
import { useLocation } from "react-router-dom";

interface LayoutProps {
  children: ReactNode;
}

const stepMap: Record<string, number> = {
  "/data-upload": 1,
  "/icp-analysis": 2,
  "/icp-tam": 3,
  "/pipeline": 4,
  "/": 5,
};

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const currentStep = stepMap[location.pathname] || 0;
  const showWorkflow = currentStep > 0;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <main className="flex-1 flex flex-col">
          <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="h-12 flex items-center px-4">
              <SidebarTrigger className="mr-4" />
              <div className="flex items-baseline gap-3">
                <h1 className="text-lg font-bold text-primary">SignalScore</h1>
                <span className="text-xs text-muted-foreground">by LaunchPulse</span>
              </div>
            </div>
            {showWorkflow && (
              <div className="border-t px-4">
                <WorkflowStepper currentStep={currentStep} />
              </div>
            )}
          </header>
          <div className="flex-1 p-6 overflow-auto">
            {children}
          </div>
          <footer className="border-t px-6 py-3 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>© 2025 LaunchPulse. All rights reserved.</span>
              <a href="#" className="hover:text-foreground transition-colors">
                Consulting Services
              </a>
            </div>
          </footer>
        </main>
      </div>
    </SidebarProvider>
  );
}