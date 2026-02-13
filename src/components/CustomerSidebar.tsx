import { LayoutDashboard, Users, ClipboardList, Kanban, Settings, LogOut, ChevronDown, ShoppingCart, Upload, Target, Building2 } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { BrandLogo } from "@/components/BrandLogo";
import { useBrandedConfig } from "@/hooks/useBrandedConfig";
import { useServiceType } from "@/hooks/use-service-type";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const topLevelNav = [
  { title: "Dashboard", url: "/my-dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
];

const salesNav = [
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Opportunities", url: "/opportunities", icon: Kanban },
];

// Self-service only nav items
const selfServiceNav = [
  { title: "Data Upload", url: "/data-upload", icon: Upload },
  { title: "ICP Manager", url: "/icp-manager", icon: Target },
  { title: "Accounts", url: "/accounts", icon: Building2 },
];

const bottomNav = [
  { title: "Settings", url: "/settings", icon: Settings },
];

export function CustomerSidebar() {
  const location = useLocation();
  const { signOut, userProfile } = useAuth();
  const currentPath = location.pathname;
  const orgId = userProfile?.org_id;
  const { data: brandConfig } = useBrandedConfig({ orgId: orgId || undefined });
  const { isSelfService } = useServiceType();

  const isActive = (path: string) => currentPath.startsWith(path);
  const isSalesActive = salesNav.some((item) => isActive(item.url));

  const getNavCls = (path: string) =>
    isActive(path)
      ? "bg-primary/10 text-primary font-semibold"
      : "hover:bg-primary/5 hover:text-primary transition-colors";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        {brandConfig?.logo_url ? (
          <img src={brandConfig.logo_url} alt={brandConfig.company_name || "Logo"} className="h-8 max-w-[160px] object-contain" />
        ) : (
          <BrandLogo variant="light" />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {topLevelNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls(item.url)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Sales collapsible group */}
              <Collapsible defaultOpen={isSalesActive}>
                <SidebarMenuItem>
                  <CollapsibleTrigger className="flex items-center gap-2 w-full rounded-md px-3 py-2 text-sm font-medium hover:bg-primary/5 hover:text-primary transition-colors">
                    <ShoppingCart className="h-4 w-4" />
                    <span className="flex-1 text-left">Sales</span>
                    <ChevronDown className="h-3 w-3 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu className="ml-4 mt-1 space-y-1">
                      {salesNav.map((item) => (
                        <SidebarMenuItem key={item.title}>
                          <SidebarMenuButton asChild>
                            <NavLink to={item.url} className={getNavCls(item.url)}>
                              <item.icon className="h-4 w-4" />
                              <span>{item.title}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              {/* Self-service only tools */}
              {isSelfService && selfServiceNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls(item.url)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {bottomNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavCls(item.url)}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
