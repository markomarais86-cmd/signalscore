import { Upload, Settings, LogOut, LayoutDashboard, Target, Database, Shield } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useRoles } from "@/hooks/use-roles";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

// Simplified navigation structure - Real workflow
const mainNavigation = [
  { title: "Overview", url: "/", icon: LayoutDashboard },
  { title: "ICP Manager", url: "/icp-manager", icon: Target },
  { title: "Accounts", url: "/accounts", icon: Database },
  { title: "Data Upload", url: "/data-upload", icon: Upload },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const location = useLocation();
  const { signOut, userProfile } = useAuth();
  const { isSuperAdmin } = useRoles();
  const currentPath = location.pathname;

  const icpContext = location.state as {
    icpId?: string;
    icpName?: string;
  } | null;

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
  
  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {mainNavigation.map((item) => (
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
              {isSuperAdmin && (
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
              )}
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