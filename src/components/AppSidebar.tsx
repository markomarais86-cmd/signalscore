import { useState } from "react";
import { Settings, LogOut, LayoutDashboard, Target, Database, Shield, TrendingUp, DollarSign, FileText, Users, BarChart3, Bot, HelpCircle, Sparkles, ChevronDown, ClipboardList, Kanban, UserPlus } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/BrandLogo";
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
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

// Core navigation - always visible
const coreNavigation = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Accounts", url: "/accounts", icon: Database },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Opportunities", url: "/opportunities", icon: Kanban },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
];

// Build section - collapsible
const buildNavigation = [
  { title: "ICP Manager", url: "/icp-manager", icon: Target },
  { title: "Enrichment", url: "/enrichment", icon: Sparkles },
];

// Configure section - collapsible
const configureNavigation = [
  { title: "AI Agents", url: "/ai-agents", icon: Bot },
  { title: "Settings", url: "/settings", icon: Settings },
  { title: "Help", url: "/help", icon: HelpCircle },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, userProfile } = useAuth();
  const { isSuperAdmin } = useRoles();
  const { flags } = useFeatureFlags();
  const currentPath = location.pathname;

  // Check if any child route in a section is active
  const isSectionActive = (items: typeof coreNavigation) => 
    items.some(item => isActive(item.url));

  // Auto-expand sections based on current route
  const [buildOpen, setBuildOpen] = useState(() => 
    buildNavigation.some(item => currentPath.startsWith(item.url))
  );
  const [configureOpen, setConfigureOpen] = useState(() => 
    configureNavigation.some(item => currentPath.startsWith(item.url))
  );
  const [analyticsOpen, setAnalyticsOpen] = useState(() => 
    ['/pipeline-efficiency', '/capital-efficiency', '/reports', '/segmentation', '/trends'].some(url => currentPath.startsWith(url))
  );

  const isActive = (path: string) => {
    if (path === "/") {
      return currentPath === "/";
    }
    return currentPath.startsWith(path);
  };

  const getNavCls = (path: string) =>
    isActive(path) 
      ? "bg-primary/10 text-primary font-semibold" 
      : "hover:bg-primary/5 hover:text-primary transition-colors";

  // Check if any analytics flags are enabled
  const hasAnalyticsFeatures = flags.pipeline_efficiency || flags.capital_efficiency || 
    flags.custom_reports || flags.advanced_segmentation || flags.trend_analysis;

  const analyticsItems = [
    { flag: flags.pipeline_efficiency, title: "Pipeline Efficiency", url: "/pipeline-efficiency", icon: TrendingUp, badge: "Phase 3" },
    { flag: flags.capital_efficiency, title: "Capital Efficiency", url: "/capital-efficiency", icon: DollarSign, badge: "Phase 3" },
    { flag: flags.custom_reports, title: "Reports", url: "/reports", icon: FileText, badge: "Phase 6" },
    { flag: flags.advanced_segmentation, title: "Segmentation", url: "/segmentation", icon: Users, badge: "Phase 6" },
    { flag: flags.trend_analysis, title: "Trends", url: "/trends", icon: BarChart3, badge: "Phase 6" },
  ].filter(item => item.flag);
  
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        <BrandLogo variant="light" />
      </SidebarHeader>
      <SidebarContent>
        {/* Core Section - Always Visible */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs text-muted-foreground uppercase tracking-wider">
            Core
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {coreNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
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
        </SidebarGroup>

        {/* Build Section - Collapsible */}
        <SidebarGroup>
          <Collapsible open={buildOpen} onOpenChange={setBuildOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
              <span>Build</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", buildOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1 mt-1">
                  {buildNavigation.map((item) => (
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
          </Collapsible>
        </SidebarGroup>

        {/* Configure Section - Collapsible */}
        <SidebarGroup>
          <Collapsible open={configureOpen} onOpenChange={setConfigureOpen}>
            <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
              <span>Configure</span>
              <ChevronDown className={cn("h-4 w-4 transition-transform", configureOpen && "rotate-180")} />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1 mt-1">
                  {configureNavigation.map((item) => (
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
          </Collapsible>
        </SidebarGroup>

        {/* Analytics Section - Feature-flagged, Collapsible */}
        {hasAnalyticsFeatures && (
          <SidebarGroup>
            <Collapsible open={analyticsOpen} onOpenChange={setAnalyticsOpen}>
              <CollapsibleTrigger className="flex w-full items-center justify-between px-2 py-1.5 text-xs text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors">
                <span>Analytics</span>
                <ChevronDown className={cn("h-4 w-4 transition-transform", analyticsOpen && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarGroupContent>
                  <SidebarMenu className="space-y-1 mt-1">
                    {analyticsItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className={getNavCls(item.url)}
                          >
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                            <Badge variant="secondary" className="ml-auto text-xs">{item.badge}</Badge>
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </CollapsibleContent>
            </Collapsible>
          </SidebarGroup>
        )}

        {/* Admin - Super admin only, separate at bottom */}
        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin"
                      className={getNavCls("/admin")}
                    >
                      <Shield className="h-4 w-4" />
                      <span>Admin</span>
                      <Badge variant="destructive" className="ml-auto text-xs">Super</Badge>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to="/admin/customer-onboarding"
                      className={getNavCls("/admin/customer-onboarding")}
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Customer Onboarding</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <div className="px-3 py-2 border-t">
          <div className="text-xs text-muted-foreground mb-2 truncate">
            {userProfile?.full_name}
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