import { LayoutDashboard, Users, ClipboardList, Kanban, Settings, LogOut } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { BrandLogo } from "@/components/BrandLogo";
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

const customerNavigation = [
  { title: "Dashboard", url: "/my-dashboard", icon: LayoutDashboard },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Tasks", url: "/tasks", icon: ClipboardList },
  { title: "Opportunities", url: "/opportunities", icon: Kanban },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function CustomerSidebar() {
  const location = useLocation();
  const { signOut, userProfile } = useAuth();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath.startsWith(path);

  const getNavCls = (path: string) =>
    isActive(path)
      ? "bg-primary/10 text-primary font-semibold"
      : "hover:bg-primary/5 hover:text-primary transition-colors";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b px-3 py-3">
        <BrandLogo variant="light" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {customerNavigation.map((item) => (
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
