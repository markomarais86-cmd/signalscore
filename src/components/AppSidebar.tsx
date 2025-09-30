import { Building2, BarChart3, TrendingUp, DollarSign, Users, Brain, Inbox, Upload, Settings, LogOut, LayoutDashboard, ChevronDown } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

// Navigation items organized by layer with feature flags
const strategyItems = [
  { title: "ICP Analysis", url: "/icp-analysis", icon: Building2, flagKey: 'icp_manager' as const },
  { title: "ICP + TAM", url: "/icp-tam", icon: TrendingUp, flagKey: 'icp_tam_intelligence' as const },
  { title: "Pipeline Efficiency", url: "/pipeline", icon: BarChart3, flagKey: 'pipeline_efficiency' as const },
  { title: "Capital Efficiency", url: "/capital", icon: DollarSign, flagKey: 'capital_efficiency' as const },
];

const executionItems = [
  { title: "Personas & Segments", url: "/personas", icon: Users, flagKey: 'personas_segments' as const },
  { title: "AI Agents & ML", url: "/ai-agents", icon: Brain, flagKey: 'ai_agents' as const },
  { title: "Leads Management", url: "/leads", icon: Inbox, flagKey: null },
];

const adminItems = [
  { title: "Data Upload", url: "/data-upload", icon: Upload, flagKey: null },
  { title: "Settings", url: "/settings", icon: Settings, flagKey: null },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, userProfile } = useAuth();
  const { flags } = useFeatureFlags();
  const currentPath = location.pathname;

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavCls = (path: string) =>
    isActive(path) ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50";

  // Filter items based on feature flags
  const filteredStrategyItems = strategyItems.filter(item => !item.flagKey || flags[item.flagKey]);
  const filteredExecutionItems = executionItems.filter(item => !item.flagKey || flags[item.flagKey]);
  
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Executive Dashboard - Always visible */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <NavLink
                    to="/"
                    end
                    className={getNavCls("/")}
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Executive Dashboard</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Strategy Layer */}
        {filteredStrategyItems.length > 0 && (
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-semibold text-sidebar-foreground px-3 py-2 hover:bg-sidebar-accent rounded-md">
                  Strategy Layer
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredStrategyItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className={getNavCls(item.url)}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* Execution Layer */}
        {filteredExecutionItems.length > 0 && (
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-semibold text-sidebar-foreground px-3 py-2 hover:bg-sidebar-accent rounded-md">
                  Execution Layer
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredExecutionItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className={getNavCls(item.url)}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        )}

        {/* Admin Layer */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-semibold text-sidebar-foreground px-3 py-2 hover:bg-sidebar-accent rounded-md">
                Admin Layer
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className={getNavCls(item.url)}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter>
        <div className="px-3 py-2 border-t">
          <div className="text-xs text-muted-foreground mb-2">
            {userProfile?.full_name} ({userProfile?.role})
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => signOut()}
            className="w-full justify-start h-8"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}