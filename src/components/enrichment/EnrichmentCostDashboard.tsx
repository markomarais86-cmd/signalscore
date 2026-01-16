import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, BarChart3, PieChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserProfile } from "@/hooks/use-user-profile";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPie, Pie, Cell, Legend } from "recharts";

interface CostSummary {
  source: string;
  record_type: string;
  records_processed: number;
  total_cost: number;
  avg_cost_per_record: number;
}

const SOURCE_COLORS: Record<string, string> = {
  gemini: '#4285F4',
  perplexity: '#8B5CF6',
  firecrawl: '#F59E0B',
  apollo: '#EF4444',
  pdl: '#10B981',
  discover: '#6366F1',
  internal: '#6B7280'
};

export function EnrichmentCostDashboard() {
  const [costData, setCostData] = useState<CostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useUserProfile();
  const orgId = profile?.org_id;

  useEffect(() => {
    if (!orgId) return;

    const loadCostData = async () => {
      // Get cost summary for last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from('enrichment_costs')
        .select('source, record_type, cost_usd')
        .eq('org_id', orgId)
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (error) {
        console.error('Error loading cost data:', error);
        setLoading(false);
        return;
      }

      // Aggregate by source
      const aggregated = new Map<string, CostSummary>();
      for (const row of data || []) {
        const key = `${row.source}-${row.record_type}`;
        const existing = aggregated.get(key) || {
          source: row.source,
          record_type: row.record_type,
          records_processed: 0,
          total_cost: 0,
          avg_cost_per_record: 0
        };
        existing.records_processed++;
        existing.total_cost += row.cost_usd || 0;
        aggregated.set(key, existing);
      }

      // Calculate averages
      for (const summary of aggregated.values()) {
        summary.avg_cost_per_record = summary.total_cost / Math.max(summary.records_processed, 1);
      }

      setCostData(Array.from(aggregated.values()));
      setLoading(false);
    };

    loadCostData();
  }, [orgId]);

  const totalCost = costData.reduce((sum, d) => sum + d.total_cost, 0);
  const totalRecords = costData.reduce((sum, d) => sum + d.records_processed, 0);
  const avgCostPerRecord = totalRecords > 0 ? totalCost / totalRecords : 0;

  // Prepare chart data
  const pieData = Object.entries(
    costData.reduce((acc, d) => {
      acc[d.source] = (acc[d.source] || 0) + d.total_cost;
      return acc;
    }, {} as Record<string, number>)
  ).map(([source, cost]) => ({
    name: source.charAt(0).toUpperCase() + source.slice(1),
    value: cost,
    color: SOURCE_COLORS[source] || '#6B7280'
  }));

  const barData = costData.map(d => ({
    source: d.source.charAt(0).toUpperCase() + d.source.slice(1),
    records: d.records_processed,
    cost: d.total_cost,
    avgCost: d.avg_cost_per_record
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Enrichment Cost Analytics
        </CardTitle>
        <CardDescription>
          Last 30 days of enrichment spend by source
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted rounded-lg p-4">
            <div className="text-3xl font-bold">${totalCost.toFixed(2)}</div>
            <div className="text-sm text-muted-foreground">Total Spend (30d)</div>
          </div>
          <div className="bg-muted rounded-lg p-4">
            <div className="text-3xl font-bold">{totalRecords.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Records Enriched</div>
          </div>
          <div className="bg-muted rounded-lg p-4">
            <div className="text-3xl font-bold">${avgCostPerRecord.toFixed(4)}</div>
            <div className="text-sm text-muted-foreground">Avg Cost/Record</div>
          </div>
        </div>

        {/* Charts */}
        {costData.length > 0 && (
          <div className="grid grid-cols-2 gap-6">
            {/* Cost by Source Pie Chart */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Cost by Source
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <RechartsPie>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toFixed(3)}`} />
                </RechartsPie>
              </ResponsiveContainer>
            </div>

            {/* Records by Source Bar Chart */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Records by Source
              </h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="source" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="records" fill="#6366F1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Cost per Source Table */}
        <div>
          <h4 className="font-medium mb-3">Cost Breakdown</h4>
          <div className="grid gap-2">
            {Object.entries(
              costData.reduce((acc, d) => {
                if (!acc[d.source]) {
                  acc[d.source] = { records: 0, cost: 0 };
                }
                acc[d.source].records += d.records_processed;
                acc[d.source].cost += d.total_cost;
                return acc;
              }, {} as Record<string, { records: number; cost: number }>)
            ).sort((a, b) => b[1].cost - a[1].cost).map(([source, data]) => (
              <div 
                key={source} 
                className="flex items-center justify-between p-2 rounded border"
              >
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: SOURCE_COLORS[source] || '#6B7280' }}
                  />
                  <span className="font-medium capitalize">{source}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Badge variant="secondary">{data.records.toLocaleString()} records</Badge>
                  <span className="font-mono">${data.cost.toFixed(3)}</span>
                  <span className="text-xs text-muted-foreground">
                    (${(data.cost / Math.max(data.records, 1)).toFixed(4)}/record)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {costData.length === 0 && !loading && (
          <div className="text-center text-muted-foreground py-8">
            No enrichment costs recorded yet. Run some enrichments to see cost analytics.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
