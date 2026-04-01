import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, Zap, TrendingUp, Users, Cpu, Building2, ChevronRight } from "lucide-react";
import { useAccountSignals, AccountSignal } from "@/hooks/useAccountSignals";
import { SIGNAL_FUEL_LINE_MAP, FUEL_LINE_TYPES } from "@/components/campaigns/constants/campaign-config";
import { cn } from "@/lib/utils";

interface SignalActionCardsProps {
  onLaunchCampaign: (context: {
    signalType: string;
    signalIds: string[];
    accountExternalIds: string[];
    suggestedName: string;
  }) => void;
  className?: string;
}

const SIGNAL_ICONS: Record<string, typeof Zap> = {
  intent: TrendingUp,
  tech_change: Cpu,
  funding: Zap,
  expansion: Building2,
  new_hire: Users,
};

const SIGNAL_LABELS: Record<string, string> = {
  intent: "Intent Signals",
  tech_change: "Tech Changes",
  funding: "New Funding",
  expansion: "Expansion",
  new_hire: "New Hires",
  data_freshness: "Data Freshness",
  multi_thread: "Multi-Thread",
  competitor: "Competitor Activity",
  contract_renewal: "Contract Renewal",
  leadership_change: "Leadership Change",
};

/** Convert snake_case signal types to readable labels */
function humanizeSignalType(type: string): string {
  if (SIGNAL_LABELS[type]) return SIGNAL_LABELS[type];
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SignalActionCards({ onLaunchCampaign, className }: SignalActionCardsProps) {
  const { signals, isLoading } = useAccountSignals({ limit: 100 });

  // Filter to unactioned high/critical priority signals
  const unactioned = signals.filter(
    (s) => !s.actioned_at && (s.signal_priority === 'high' || s.signal_priority === 'critical')
  );

  // Group by signal_type
  const grouped = unactioned.reduce<Record<string, AccountSignal[]>>((acc, s) => {
    acc[s.signal_type] = acc[s.signal_type] || [];
    acc[s.signal_type].push(s);
    return acc;
  }, {});

  const signalTypes = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (signalTypes.length === 0) return null;

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          Signal-Ready Campaigns
          <Badge variant="secondary" className="ml-auto text-xs">
            {unactioned.length} unactioned
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {signalTypes.slice(0, 4).map(([type, typeSignals]) => {
            const Icon = SIGNAL_ICONS[type] || Zap;
            const mapping = SIGNAL_FUEL_LINE_MAP[type];
            const fuelLineLabel = mapping ? FUEL_LINE_TYPES[mapping.fuelLine]?.label : 'Custom';

            return (
              <button
                key={type}
                onClick={() =>
                  onLaunchCampaign({
                    signalType: type,
                    signalIds: typeSignals.map((s) => s.id),
                    accountExternalIds: [...new Set(typeSignals.map((s) => s.account_external_id))],
                    suggestedName: `${SIGNAL_LABELS[type] || type} Campaign`,
                  })
                }
                className="flex flex-col items-start gap-2 p-4 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/40 transition-all text-left group"
              >
                <div className="flex items-center gap-2 w-full">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-2xl font-bold">{typeSignals.length}</span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div>
                  <div className="text-sm font-medium">{SIGNAL_LABELS[type] || type}</div>
                  <div className="text-xs text-muted-foreground">
                    {[...new Set(typeSignals.map((s) => s.account_external_id))].length} accounts · {fuelLineLabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
