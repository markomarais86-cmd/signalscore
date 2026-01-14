import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Coins, TrendingUp, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CreditsData {
  used: number;
  total: number;
  resetAt: Date | null;
}

interface CreditsDisplayProps {
  variant?: 'compact' | 'full';
  className?: string;
  onBuyCredits?: () => void;
}

export function CreditsDisplay({ 
  variant = 'compact', 
  className,
  onBuyCredits 
}: CreditsDisplayProps) {
  const { userProfile } = useAuth();
  const [credits, setCredits] = useState<CreditsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userProfile?.org_id) return;

    const loadCredits = async () => {
      try {
        const { data: org, error } = await supabase
          .from('organizations')
          .select('enrichment_credits_used, enrichment_credits_total, enrichment_credits_reset_at')
          .eq('id', userProfile.org_id)
          .single();

        if (error) throw error;

        setCredits({
          used: org?.enrichment_credits_used || 0,
          total: org?.enrichment_credits_total || 1000,
          resetAt: org?.enrichment_credits_reset_at ? new Date(org.enrichment_credits_reset_at) : null
        });
      } catch (error) {
        console.error('Error loading credits:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCredits();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('credits-updates')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'organizations',
        filter: `id=eq.${userProfile.org_id}`
      }, (payload) => {
        const newData = payload.new as any;
        setCredits({
          used: newData.enrichment_credits_used || 0,
          total: newData.enrichment_credits_total || 1000,
          resetAt: newData.enrichment_credits_reset_at ? new Date(newData.enrichment_credits_reset_at) : null
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.org_id]);

  if (loading || !credits) {
    return null;
  }

  const remaining = credits.total - credits.used;
  const percentUsed = Math.round((credits.used / credits.total) * 100);
  const isLow = remaining < credits.total * 0.2;
  const isCritical = remaining < credits.total * 0.05;

  if (variant === 'compact') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 cursor-default",
                isCritical && "border-destructive text-destructive bg-destructive/10",
                isLow && !isCritical && "border-yellow-500 text-yellow-600 bg-yellow-500/10",
                !isLow && "border-primary/30 text-primary bg-primary/5",
                className
              )}
            >
              <Coins className="h-3.5 w-3.5" />
              <span className="font-semibold">{remaining.toLocaleString()}</span>
              <span className="text-muted-foreground">credits</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="w-64 p-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Credits Used</span>
                <span className="font-medium">{credits.used.toLocaleString()} / {credits.total.toLocaleString()}</span>
              </div>
              <Progress value={percentUsed} className="h-1.5" />
              <p className="text-xs text-muted-foreground">
                Launch Pulse enrichment uses 1 credit per record
              </p>
              {onBuyCredits && remaining < 100 && (
                <Button size="sm" className="w-full mt-2" onClick={onBuyCredits}>
                  <TrendingUp className="h-3 w-3 mr-1" />
                  Get More Credits
                </Button>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full variant
  return (
    <div className={cn("rounded-lg border bg-card p-4", className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="font-medium">Launch Pulse Credits</p>
            <p className="text-xs text-muted-foreground">Proprietary enrichment</p>
          </div>
        </div>
        {isCritical && (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Low Credits
          </Badge>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-3xl font-bold">{remaining.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">credits remaining</p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <p>{credits.used.toLocaleString()} used</p>
            <p>of {credits.total.toLocaleString()} total</p>
          </div>
        </div>

        <Progress 
          value={percentUsed} 
          className={cn(
            "h-2",
            isCritical && "[&>div]:bg-destructive",
            isLow && !isCritical && "[&>div]:bg-yellow-500"
          )} 
        />

        {credits.resetAt && (
          <p className="text-xs text-muted-foreground">
            Resets on {credits.resetAt.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })}
          </p>
        )}

        {onBuyCredits && (
          <Button 
            variant={isCritical ? "default" : "outline"} 
            size="sm" 
            className="w-full"
            onClick={onBuyCredits}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            {isCritical ? "Buy More Credits" : "Upgrade Plan"}
          </Button>
        )}
      </div>
    </div>
  );
}
