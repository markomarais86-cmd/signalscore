import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { RefreshCcw, Gift, ArrowRightLeft, RotateCcw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CreditAdjustment {
  id: string;
  org_id: string;
  adjustment_type: string;
  previous_used: number | null;
  previous_total: number | null;
  previous_bonus: number | null;
  new_used: number | null;
  new_total: number | null;
  new_bonus: number | null;
  credits_added: number | null;
  reason: string | null;
  performed_by: string;
  created_at: string;
  organizations?: { name: string } | null;
}

interface CreditAdjustmentHistoryProps {
  orgId?: string; // Optional: filter by org
  limit?: number;
}

const typeConfig: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  top_up: { label: "Top-Up", icon: <Gift className="h-3 w-3" />, variant: "default" },
  reset: { label: "Monthly Reset", icon: <RotateCcw className="h-3 w-3" />, variant: "secondary" },
  plan_change: { label: "Plan Change", icon: <ArrowRightLeft className="h-3 w-3" />, variant: "outline" },
  manual: { label: "Manual", icon: <RefreshCcw className="h-3 w-3" />, variant: "outline" },
  consumption: { label: "Usage", icon: null, variant: "secondary" },
};

export const CreditAdjustmentHistory = ({ orgId, limit = 50 }: CreditAdjustmentHistoryProps) => {
  const [adjustments, setAdjustments] = useState<CreditAdjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    const fetchAdjustments = async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("credit_adjustments")
          .select(`
            *,
            organizations (name)
          `)
          .order("created_at", { ascending: false })
          .limit(limit);

        if (orgId) {
          query = query.eq("org_id", orgId);
        }

        if (typeFilter !== "all") {
          query = query.eq("adjustment_type", typeFilter);
        }

        const { data, error } = await query;

        if (error) throw error;
        setAdjustments(data || []);
      } catch (error) {
        console.error("Error fetching credit adjustments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAdjustments();
  }, [orgId, limit, typeFilter]);

  const formatChange = (adj: CreditAdjustment): string => {
    if (adj.adjustment_type === "top_up" && adj.credits_added) {
      return `+${adj.credits_added} bonus`;
    }
    if (adj.adjustment_type === "reset") {
      return `${adj.previous_used || 0} → 0 used`;
    }
    if (adj.adjustment_type === "plan_change") {
      const prevTotal = adj.previous_total ?? "?";
      const newTotal = adj.new_total ?? "unlimited";
      return `${prevTotal} → ${newTotal} limit`;
    }
    return "-";
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Credit Adjustment History</h3>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="top_up">Top-Ups</SelectItem>
            <SelectItem value="reset">Monthly Resets</SelectItem>
            <SelectItem value="plan_change">Plan Changes</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {adjustments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No credit adjustments found
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="block sm:hidden space-y-3">
            {adjustments.map((adj) => {
              const config = typeConfig[adj.adjustment_type] || typeConfig.manual;
              return (
                <div key={adj.id} className="border rounded-lg p-3 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant={config.variant} className="gap-1">
                      {config.icon}
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(adj.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {!orgId && (
                    <div className="text-sm font-medium">{adj.organizations?.name || "Unknown"}</div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono">{formatChange(adj)}</span>
                    <span>{adj.performed_by === "system" ? <Badge variant="outline">System</Badge> : adj.performed_by}</span>
                  </div>
                  {adj.reason && (
                    <p className="text-xs text-muted-foreground truncate">{adj.reason}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  {!orgId && <TableHead>Organization</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments.map((adj) => {
                  const config = typeConfig[adj.adjustment_type] || typeConfig.manual;
                  return (
                    <TableRow key={adj.id}>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDistanceToNow(new Date(adj.created_at), { addSuffix: true })}
                      </TableCell>
                      {!orgId && (
                        <TableCell className="font-medium">
                          {adj.organizations?.name || "Unknown"}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={config.variant} className="gap-1">
                          {config.icon}
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatChange(adj)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {adj.performed_by === "system" ? (
                          <Badge variant="outline">System</Badge>
                        ) : (
                          adj.performed_by
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {adj.reason || "-"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};
