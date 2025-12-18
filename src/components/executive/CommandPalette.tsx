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
  Target, 
  Sparkles, 
  RefreshCw, 
  Download, 
  Users, 
  Building2, 
  Settings, 
  LayoutDashboard,
  Activity,
  Zap,
  Search,
  FileText,
  TrendingUp,
  Database,
  BarChart3,
  Bot,
  Lightbulb,
  MapPin
} from "lucide-react";

interface CommandPaletteProps {
  onScoreAccounts?: () => void;
  onEnrich?: () => void;
  onSyncApollo?: () => void;
  onRefresh?: () => void;
  onToggleHealth?: () => void;
  isScoring?: boolean;
  isSyncing?: boolean;
}

interface CommandAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  action: () => void;
  group: 'quick-actions' | 'navigation' | 'ai-actions';
  keywords?: string[];
  shortcut?: string;
}

export function CommandPalette({
  onScoreAccounts,
  onEnrich,
  onSyncApollo,
  onRefresh,
  onToggleHealth,
  isScoring,
  isSyncing
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // Register keyboard shortcut
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

  const runCommand = useCallback((callback: () => void) => {
    setOpen(false);
    callback();
  }, []);

  const actions: CommandAction[] = [
    // Quick Actions
    {
      id: 'score',
      label: isScoring ? 'Scoring in Progress...' : 'Score All Accounts',
      description: 'Run ICP scoring on all accounts',
      icon: Target,
      action: () => onScoreAccounts?.(),
      group: 'quick-actions',
      keywords: ['score', 'icp', 'fit', 'calculate'],
      shortcut: '⌘S'
    },
    {
      id: 'enrich',
      label: 'Enrich Accounts',
      description: 'Add missing data via AI or providers',
      icon: Sparkles,
      action: () => onEnrich?.(),
      group: 'quick-actions',
      keywords: ['enrich', 'data', 'fill', 'complete'],
      shortcut: '⌘E'
    },
    {
      id: 'sync-apollo',
      label: isSyncing ? 'Syncing Apollo...' : 'Sync Apollo Data',
      description: 'Refresh TAM from Apollo',
      icon: RefreshCw,
      action: () => onSyncApollo?.(),
      group: 'quick-actions',
      keywords: ['sync', 'apollo', 'tam', 'refresh', 'market'],
    },
    {
      id: 'refresh',
      label: 'Refresh Dashboard',
      description: 'Reload all dashboard data',
      icon: RefreshCw,
      action: () => onRefresh?.(),
      group: 'quick-actions',
      keywords: ['refresh', 'reload', 'update'],
      shortcut: '⌘R'
    },
    {
      id: 'export',
      label: 'Export Data',
      description: 'Download accounts or contacts as CSV',
      icon: Download,
      action: () => navigate('/accounts?action=export'),
      group: 'quick-actions',
      keywords: ['export', 'download', 'csv', 'data'],
    },
    {
      id: 'toggle-health',
      label: 'Toggle System Health',
      description: 'Show/hide health monitoring',
      icon: Activity,
      action: () => onToggleHealth?.(),
      group: 'quick-actions',
      keywords: ['health', 'monitoring', 'system', 'status'],
    },

    // Navigation
    {
      id: 'nav-dashboard',
      label: 'Go to Dashboard',
      icon: LayoutDashboard,
      action: () => navigate('/'),
      group: 'navigation',
      keywords: ['dashboard', 'home', 'main'],
    },
    {
      id: 'nav-accounts',
      label: 'Go to Accounts',
      icon: Building2,
      action: () => navigate('/accounts'),
      group: 'navigation',
      keywords: ['accounts', 'companies', 'organizations'],
    },
    {
      id: 'nav-leads',
      label: 'Go to Contacts',
      icon: Users,
      action: () => navigate('/leads'),
      group: 'navigation',
      keywords: ['leads', 'contacts', 'people'],
    },
    {
      id: 'nav-icp',
      label: 'Go to ICP Manager',
      icon: Target,
      action: () => navigate('/icp-manager'),
      group: 'navigation',
      keywords: ['icp', 'profile', 'criteria', 'ideal'],
    },
    {
      id: 'nav-trends',
      label: 'Go to Trends',
      icon: TrendingUp,
      action: () => navigate('/trends'),
      group: 'navigation',
      keywords: ['trends', 'analytics', 'history'],
    },
    {
      id: 'nav-pipeline',
      label: 'Go to Pipeline Analytics',
      icon: BarChart3,
      action: () => navigate('/pipeline-analytics'),
      group: 'navigation',
      keywords: ['pipeline', 'deals', 'sales', 'analytics'],
    },
    {
      id: 'nav-discovery',
      label: 'Go to Discovery',
      icon: Search,
      action: () => navigate('/discovery'),
      group: 'navigation',
      keywords: ['discovery', 'search', 'find'],
    },
    {
      id: 'nav-segments',
      label: 'Go to Segmentation',
      icon: MapPin,
      action: () => navigate('/segmentation'),
      group: 'navigation',
      keywords: ['segments', 'segmentation', 'groups'],
    },
    {
      id: 'nav-agents',
      label: 'Go to AI Agents',
      icon: Bot,
      action: () => navigate('/ai-agents'),
      group: 'navigation',
      keywords: ['agents', 'ai', 'automation'],
    },
    {
      id: 'nav-settings',
      label: 'Go to Settings',
      icon: Settings,
      action: () => navigate('/settings'),
      group: 'navigation',
      keywords: ['settings', 'preferences', 'config'],
    },
    {
      id: 'nav-upload',
      label: 'Go to Data Upload',
      icon: Database,
      action: () => navigate('/data-upload'),
      group: 'navigation',
      keywords: ['upload', 'import', 'csv', 'data'],
    },

    // AI Actions
    {
      id: 'ai-insights',
      label: 'Generate AI Insights',
      description: 'Get AI-powered recommendations',
      icon: Lightbulb,
      action: () => navigate('/?action=insights'),
      group: 'ai-actions',
      keywords: ['ai', 'insights', 'recommendations', 'suggestions'],
    },
    {
      id: 'ai-enrich-free',
      label: 'AI Enrichment (Free)',
      description: 'Enrich with AI estimates - no credits',
      icon: Zap,
      action: () => onEnrich?.(),
      group: 'ai-actions',
      keywords: ['ai', 'enrich', 'free', 'estimate'],
    },
  ];

  const quickActions = actions.filter(a => a.group === 'quick-actions');
  const navigation = actions.filter(a => a.group === 'navigation');
  const aiActions = actions.filter(a => a.group === 'ai-actions');

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        
        <CommandGroup heading="Quick Actions">
          {quickActions.map((action) => (
            <CommandItem
              key={action.id}
              onSelect={() => runCommand(action.action)}
              className="flex items-center gap-3 py-3"
            >
              <action.icon className="h-4 w-4 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{action.label}</span>
                {action.description && (
                  <span className="text-xs text-muted-foreground">{action.description}</span>
                )}
              </div>
              {action.shortcut && (
                <span className="ml-auto text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {action.shortcut}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="AI Actions">
          {aiActions.map((action) => (
            <CommandItem
              key={action.id}
              onSelect={() => runCommand(action.action)}
              className="flex items-center gap-3 py-3"
            >
              <action.icon className="h-4 w-4 text-primary" />
              <div className="flex flex-col">
                <span>{action.label}</span>
                {action.description && (
                  <span className="text-xs text-muted-foreground">{action.description}</span>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigation">
          {navigation.map((action) => (
            <CommandItem
              key={action.id}
              onSelect={() => runCommand(action.action)}
              className="flex items-center gap-3 py-2"
            >
              <action.icon className="h-4 w-4 text-muted-foreground" />
              <span>{action.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

// Trigger button for the command palette
export function CommandPaletteTrigger({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="hidden md:inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 border border-input rounded-md bg-background hover:bg-accent"
    >
      <Search className="h-3.5 w-3.5" />
      <span>Search</span>
      <kbd className="pointer-events-none ml-2 inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
        <span className="text-xs">⌘</span>K
      </kbd>
    </button>
  );
}
