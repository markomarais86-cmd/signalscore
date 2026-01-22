import { useEffect, useState } from "react";
import { Bell, AlertTriangle, CheckCircle2, DollarSign, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Notification {
  id: string;
  type: 'budget_warning' | 'budget_exceeded' | 'enrichment_complete' | 'candidates_pending' | 'circuit_open' | 'daily_budget_warning';
  message: string;
  timestamp: string;
  read: boolean;
}

export function EnrichmentNotifications() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userProfile?.org_id) return;

    // Set up real-time subscription for enrichment events
    const channel = supabase
      .channel('enrichment-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'enrichment_history',
          filter: `org_id=eq.${userProfile.org_id}`
        },
        (payload) => {
          handleEnrichmentEvent(payload.new);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'deep_research_candidates',
          filter: `org_id=eq.${userProfile.org_id}`
        },
        () => {
          checkPendingCandidates();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'service_health'
        },
        (payload) => {
          const newState = payload.new as any;
          if (newState.circuit_state === 'open') {
            addNotification({
              type: 'circuit_open',
              message: `${newState.service_name} circuit breaker opened - provider temporarily disabled`
            });
          }
        }
      )
      .subscribe();

    // Check budget on mount
    checkBudgetStatus();
    
    // Check daily AI budget
    checkDailyAIBudget();

    // Check pending candidates
    checkPendingCandidates();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile]);

  useEffect(() => {
    setUnreadCount(notifications.filter(n => !n.read).length);
  }, [notifications]);

  const handleEnrichmentEvent = (enrichmentData: any) => {
    if (enrichmentData.enriched_from === 'deep_research') {
      addNotification({
        type: 'enrichment_complete',
        message: `Deep research completed for ${enrichmentData.account_name || 'account'}`
      });
    }
  };

  const checkBudgetStatus = async () => {
    if (!userProfile?.org_id) return;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    try {
      // Get spending
      const { data: spendingData } = await supabase
        .from('enrichment_spending')
        .select('total_spent')
        .eq('org_id', userProfile.org_id)
        .eq('phase', 'deep_research')
        .eq('month_start', monthStart.toISOString().split('T')[0]);

      const spent = spendingData?.reduce((sum, r) => sum + Number(r.total_spent), 0) || 0;

      // Get budget cap
      const { data: settingsData } = await supabase
        .from('automation_settings')
        .select('schedule_frequency')
        .eq('org_id', userProfile.org_id)
        .eq('setting_key', 'deep_research_auto')
        .maybeSingle();

      const configData = settingsData?.schedule_frequency ? JSON.parse(settingsData.schedule_frequency) : {};
      const budget = configData.monthly_budget || 50;
      const usagePercent = (spent / budget) * 100;

      if (usagePercent >= 100) {
        addNotification({
          type: 'budget_exceeded',
          message: `Budget exceeded: $${spent.toFixed(2)} / $${budget} used. Deep research paused.`
        });
      } else if (usagePercent >= 80) {
        addNotification({
          type: 'budget_warning',
          message: `Budget 80% used: $${spent.toFixed(2)} / $${budget}`
        });
      }
    } catch (error) {
      console.error('Error checking budget:', error);
    }
  };

  const checkPendingCandidates = async () => {
    if (!userProfile?.org_id) return;

    try {
      const { data, error } = await supabase
        .from('deep_research_candidates')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', userProfile.org_id)
        .is('selected', null)
        .is('dismissed', null);

      if (!error && data && (data as any).count > 0) {
        addNotification({
          type: 'candidates_pending',
          message: `${(data as any).count} ambiguous matches need review`
        });
      }
    } catch (error) {
      console.error('Error checking candidates:', error);
    }
  };

  const checkDailyAIBudget = async () => {
    if (!userProfile?.org_id) return;
    
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    try {
      const { data } = await supabase
        .from('ai_usage_tracking')
        .select('cost_estimate')
        .eq('org_id', userProfile.org_id)
        .gte('created_at', todayStart.toISOString());
      
      const dailyCost = (data || []).reduce((sum, r) => sum + (Number(r.cost_estimate) || 0), 0);
      const dailyBudget = 50; // $50/day default
      const usagePercent = (dailyCost / dailyBudget) * 100;
      
      if (usagePercent >= 90) {
        addNotification({
          type: 'daily_budget_warning',
          message: `Daily AI budget 90% used: $${dailyCost.toFixed(2)} / $${dailyBudget}`
        });
      }
    } catch (error) {
      console.error('Error checking daily AI budget:', error);
    }
  };

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Math.random().toString(36),
      timestamp: new Date().toISOString(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev].slice(0, 10)); // Keep last 10

    // Also show toast
    toast({
      title: "Enrichment Update",
      description: notification.message,
      variant: notification.type.includes('exceeded') ? 'destructive' : 'default'
    });
  };

  const markAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'budget_warning':
      case 'budget_exceeded':
        return <DollarSign className="h-4 w-4" />;
      case 'daily_budget_warning':
        return <DollarSign className="h-4 w-4 text-warning" />;
      case 'enrichment_complete':
        return <CheckCircle2 className="h-4 w-4" />;
      case 'candidates_pending':
        return <Bell className="h-4 w-4" />;
      case 'circuit_open':
        return <XCircle className="h-4 w-4 text-destructive" />;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex justify-between items-center">
          <span>Enrichment Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead}>
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={`flex items-start gap-3 cursor-pointer ${!notification.read ? 'bg-muted/50' : ''}`}
              onClick={() => markAsRead(notification.id)}
            >
              <div className="mt-1">{getNotificationIcon(notification.type)}</div>
              <div className="flex-1">
                <p className="text-sm">{notification.message}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(notification.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
