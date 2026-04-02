import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Users,
  Building2,
  Target,
  Sparkles,
  Settings,
  Search,
  Zap,
  RefreshCw,
  Download,
  Database,
  BarChart3,
  TrendingUp,
  FileText,
  HelpCircle,
  Rocket,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
  group: "navigation" | "quick-actions" | "ai-actions";
  keywords: string[];
  shortcut?: string;
}

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userProfile } = useAuth();
  const { toast } = useToast();

  // Global keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runAction = useCallback((action: () => void) => {
    setOpen(false);
    action();
  }, []);

  const refreshDashboard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    toast({
      title: "Dashboard Refreshed",
      description: "All metrics have been updated.",
    });
  }, [queryClient, toast]);

  const actions: CommandAction[] = [
    // Navigation
    {
      id: "nav-dashboard",
      label: "Go to Dashboard",
      description: "Executive overview with key metrics",
      icon: LayoutDashboard,
      action: () => navigate("/"),
      group: "navigation",
      keywords: ["home", "main", "overview", "executive"],
      shortcut: "⌘D",
    },
    {
      id: "nav-accounts",
      label: "Go to Accounts",
      description: "Browse and manage accounts",
      icon: Building2,
      action: () => navigate("/accounts"),
      group: "navigation",
      keywords: ["companies", "organizations", "firms"],
    },
    {
      id: "nav-leads",
      label: "Go to Leads",
      description: "View contacts and leads",
      icon: Users,
      action: () => navigate("/leads"),
      group: "navigation",
      keywords: ["contacts", "people", "prospects"],
    },
    {
      id: "nav-icp",
      label: "Go to ICP Manager",
      description: "Configure ideal customer profiles",
      icon: Target,
      action: () => navigate("/icp-manager"),
      group: "navigation",
      keywords: ["ideal", "customer", "profile", "criteria", "persona"],
    },
    {
      id: "nav-enrichment",
      label: "Go to Enrichment",
      description: "Enrich and enhance data",
      icon: Sparkles,
      action: () => navigate("/enrichment"),
      group: "navigation",
      keywords: ["data", "enhance", "quality"],
    },
    {
      id: "nav-list-builder",
      label: "Go to List Builder",
      description: "Build targeted account lists",
      icon: Rocket,
      action: () => navigate("/list-builder"),
      group: "navigation",
      keywords: ["marketing", "outreach", "email", "campaigns", "lists"],
    },
    {
      id: "nav-analytics",
      label: "Go to Pipeline Analytics",
      description: "View reports and insights",
      icon: BarChart3,
      action: () => navigate("/pipeline-efficiency"),
      group: "navigation",
      keywords: ["reports", "metrics", "data", "insights", "analytics"],
    },
    {
      id: "nav-settings",
      label: "Go to Settings",
      description: "Configure application settings",
      icon: Settings,
      action: () => navigate("/settings"),
      group: "navigation",
      keywords: ["config", "preferences", "options"],
    },
    // Quick Actions
    {
      id: "action-refresh",
      label: "Refresh Dashboard",
      description: "Reload all dashboard metrics",
      icon: RefreshCw,
      action: refreshDashboard,
      group: "quick-actions",
      keywords: ["reload", "update", "sync"],
      shortcut: "⌘R",
    },
    {
      id: "action-score",
      label: "Score All Accounts",
      description: "Run scoring on all accounts",
      icon: TrendingUp,
      action: () => {
        navigate("/");
        toast({
          title: "Navigate to Dashboard",
          description: "Use the Score Accounts button to trigger scoring.",
        });
      },
      group: "quick-actions",
      keywords: ["fit", "icp", "calculate", "rank"],
    },
    {
      id: "action-enrich",
      label: "Enrich Data",
      description: "Start data enrichment workflow",
      icon: Database,
      action: () => navigate("/enrichment"),
      group: "quick-actions",
      keywords: ["enhance", "fill", "complete"],
    },
    {
      id: "action-export",
      label: "Export Data",
      description: "Export accounts or leads to CSV",
      icon: Download,
      action: () => navigate("/settings?tab=export-history"),
      group: "quick-actions",
      keywords: ["csv", "download", "file"],
    },
    {
      id: "action-upload",
      label: "Upload Data",
      description: "Import CSV data",
      icon: FileText,
      action: () => navigate("/settings?tab=data-upload"),
      group: "quick-actions",
      keywords: ["import", "csv", "file"],
    },
    // AI Actions
    {
      id: "ai-assistant",
      label: "Ask AI...",
      description: "Open AI assistant (⌘J)",
      icon: Sparkles,
      action: () => window.dispatchEvent(new Event("openGlobalAI")),
      group: "ai-actions",
      keywords: ["chat", "ask", "help", "assistant", "ai"],
      shortcut: "⌘J",
    },
    {
      id: "ai-discover",
      label: "AI Contact Discovery",
      description: "Find new contacts using AI",
      icon: Sparkles,
      action: () => navigate("/icp-manager?action=discover"),
      group: "ai-actions",
      keywords: ["find", "contacts", "apollo", "lookup"],
    },
    {
      id: "ai-insights",
      label: "Generate Insights",
      description: "Get AI-powered recommendations",
      icon: Zap,
      action: () => {
        navigate("/");
        toast({
          title: "AI Insights",
          description: "Check the Insights panel on the dashboard for AI recommendations.",
        });
      },
      group: "ai-actions",
      keywords: ["recommend", "suggest", "analyze"],
    },
    {
      id: "help",
      label: "Help & Documentation",
      description: "View help and documentation",
      icon: HelpCircle,
      action: () => {
        toast({
          title: "Help",
          description: "Click the ? icon in the header for contextual help.",
        });
      },
      group: "quick-actions",
      keywords: ["docs", "support", "guide"],
    },
  ];

  const navigationActions = actions.filter((a) => a.group === "navigation");
  const quickActions = actions.filter((a) => a.group === "quick-actions");
  const aiActions = actions.filter((a) => a.group === "ai-actions");

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {navigationActions.map((action) => (
            <CommandItem
              key={action.id}
              onSelect={() => runAction(action.action)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <action.icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span>{action.label}</span>
                  {action.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  )}
                </div>
              </div>
              {action.shortcut && (
                <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  {action.shortcut}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          {quickActions.map((action) => (
            <CommandItem
              key={action.id}
              onSelect={() => runAction(action.action)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <action.icon className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span>{action.label}</span>
                  {action.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  )}
                </div>
              </div>
              {action.shortcut && (
                <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  {action.shortcut}
                </kbd>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="AI & Automation">
          {aiActions.map((action) => (
            <CommandItem
              key={action.id}
              onSelect={() => runAction(action.action)}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <action.icon className="h-4 w-4 text-primary" />
                <div>
                  <span>{action.label}</span>
                  {action.description && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      {action.description}
                    </span>
                  )}
                </div>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

// Trigger button for the command palette
export function CommandPaletteTrigger() {
  return (
    <button
      onClick={() => {
        // Dispatch keyboard event to trigger command palette
        const event = new KeyboardEvent("keydown", {
          key: "k",
          metaKey: true,
          bubbles: true,
        });
        document.dispatchEvent(event);
      }}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-border hover:border-primary/50 bg-card/50"
    >
      <Search className="h-4 w-4" />
      <span className="hidden sm:inline">Search</span>
      <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        ⌘K
      </kbd>
    </button>
  );
}
