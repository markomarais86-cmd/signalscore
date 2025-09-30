import { Building2, BarChart3, TrendingUp, DollarSign, Users, Brain, Inbox, Upload, Settings, LogOut, LayoutDashboard, ChevronDown, Target } from "lucide-react";
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

// Navigation items organized by MVP phases
const mvpItems = [
  { title: "ICP Analysis", url: "/icp-analysis", icon: Building2, description: "View CRM → ICP fit" },
  { title: "ICP Manager", url: "/icp-manager", icon: Target, description: "Build & manage ICPs" },
  { title: "TAM Intelligence", url: "/icp-tam", icon: TrendingUp, description: "Coverage & whitespace" },
  { title: "Leads", url: "/leads", icon: Inbox, description: "Scored accounts" },
];

const phase2Items = [
  { title: "Personas & Segments", url: "/personas", icon: Users, flagKey: 'personas_segments' as const },
];

const phase3Items = [
  { title: "Pipeline Efficiency", url: "/pipeline", icon: BarChart3, flagKey: 'pipeline_efficiency' as const },
  { title: "Capital Efficiency", url: "/capital", icon: DollarSign, flagKey: 'capital_efficiency' as const },
];

const phase4Items = [
  { title: "AI Agents & ML", url: "/ai-agents", icon: Brain, flagKey: 'ai_agents' as const },
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
    isActive(path) 
      ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary" 
      : "hover:bg-primary/5 hover:text-primary border-l-4 border-transparent";

  // Filter phase items based on feature flags
  const filteredPhase2Items = phase2Items.filter(item => !item.flagKey || flags[item.flagKey]);
  const filteredPhase3Items = phase3Items.filter(item => !item.flagKey || flags[item.flagKey]);
  const filteredPhase4Items = phase4Items.filter(item => !item.flagKey || flags[item.flagKey]);
  
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

        {/* MVP Core - Always visible */}
        <Collapsible defaultOpen className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-bold text-primary uppercase tracking-wider px-3 py-2 hover:text-primary/80 transition-colors">
                Phase 1 - MVP Core
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mvpItems.map((item) => (
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

        {/* Phase 2 - Scoring & Reporting (Labs) */}
        {filteredPhase2Items.length > 0 && (
          <Collapsible className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 hover:text-primary transition-colors">
                  Phase 2 - Labs
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredPhase2Items.map((item) => (
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

        {/* Phase 3 - Pipeline Intelligence (Labs) */}
        {filteredPhase3Items.length > 0 && (
          <Collapsible className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 hover:text-primary transition-colors">
                  Phase 3 - Labs
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredPhase3Items.map((item) => (
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

        {/* Phase 4 - AI Propensity (Labs) */}
        {filteredPhase4Items.length > 0 && (
          <Collapsible className="group/collapsible">
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 hover:text-primary transition-colors">
                  Phase 4 - Labs
                  <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                </CollapsibleTrigger>
              </SidebarGroupLabel>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {filteredPhase4Items.map((item) => (
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
              <CollapsibleTrigger className="flex w-full items-center justify-between text-xs font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 hover:text-primary transition-colors">
                Configuration
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