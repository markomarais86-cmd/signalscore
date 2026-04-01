import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { LoadingState } from "@/components/LoadingState";
import { Activity, Key, Zap, TrendingUp, Clock, AlertTriangle, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { formatDistanceToNow, format, subDays } from "date-fns";

interface RateLimit {
  id: string;
  endpoint: string;
  requests_count: number;
  max_requests_per_window: number;
  window_duration_seconds: number;
  window_start: string;
  last_request_at: string;
}

interface APIKey {
  id: string;
  name: string;
  key_prefix: string;
  last_used_at: string | null;
  is_active: boolean;
  created_at: string;
  scopes: string[] | null;
}

export function APIRateLimitDashboard() {
  const [limits, setLimits] = useState<RateLimit[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { effectiveOrgId } = useEffectiveOrg();
  const orgId = effectiveOrgId || userProfile?.org_id;

  useEffect(() => {
    if (orgId) loadData();
  }, [orgId]);

  const loadData = async () => {
    if (!orgId) return;
    setLoading(true);
    const [limitsRes, keysRes] = await Promise.all([
      supabase.from("rate_limits").select("*").eq("org_id", orgId).order("last_request_at", { ascending: false }),
      supabase.from("api_keys").select("id,name,key_prefix,last_used_at,is_active,created_at,scopes").eq("org_id", orgId).order("created_at", { ascending: false }),
    ]);
    setLimits(limitsRes.data || []);
    setApiKeys(keysRes.data || []);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const totalRequests = limits.reduce((s, l) => s + l.requests_count, 0);
    const throttled = limits.filter((l) => l.requests_count >= l.max_requests_per_window).length;
    const activeKeys = apiKeys.filter((k) => k.is_active).length;
    return { totalRequests, throttled, activeKeys, totalKeys: apiKeys.length };
  }, [limits, apiKeys]);

  const chartData = useMemo(() => {
    const byEndpoint: Record<string, number> = {};
    limits.forEach((l) => {
      byEndpoint[l.endpoint] = (byEndpoint[l.endpoint] || 0) + l.requests_count;
    });
    return Object.entries(byEndpoint)
      .map(([endpoint, count]) => ({ endpoint: endpoint.replace(/^\//, ""), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [limits]);

  if (loading) return <LoadingState message="Loading API usage data…" />;

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Activity className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Total Requests</p>
                <p className="text-2xl font-bold">{stats.totalRequests.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-5 w-5 text-destructive" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Throttled Endpoints</p>
                <p className="text-2xl font-bold">{stats.throttled}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent"><Key className="h-5 w-5 text-accent-foreground" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Active API Keys</p>
                <p className="text-2xl font-bold">{stats.activeKeys} / {stats.totalKeys}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-secondary"><Zap className="h-5 w-5 text-secondary-foreground" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Active Rate Windows</p>
                <p className="text-2xl font-bold">{limits.filter((l) => new Date(l.window_start).getTime() + l.window_duration_seconds * 1000 > Date.now()).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage"><BarChart3 className="h-4 w-4 mr-2" />Usage</TabsTrigger>
          <TabsTrigger value="limits"><Zap className="h-4 w-4 mr-2" />Rate Limits</TabsTrigger>
          <TabsTrigger value="keys"><Key className="h-4 w-4 mr-2" />API Keys</TabsTrigger>
        </TabsList>

        {/* Usage chart */}
        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Requests by Endpoint</CardTitle>
              <CardDescription>Top 10 endpoints by total request count</CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No API usage data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={chartData} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" className="text-xs fill-muted-foreground" />
                    <YAxis type="category" dataKey="endpoint" width={110} className="text-xs fill-muted-foreground" />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                    <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rate limits detail */}
        <TabsContent value="limits">
          <Card>
            <CardHeader>
              <CardTitle>Active Rate Limits</CardTitle>
              <CardDescription>Current rate limit windows and usage</CardDescription>
            </CardHeader>
            <CardContent>
              {limits.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No rate limit data yet. Limits appear after API usage.</p>
              ) : (
                <div className="space-y-4">
                  {limits.map((limit) => {
                    const pct = Math.round((limit.requests_count / limit.max_requests_per_window) * 100);
                    const windowEnd = new Date(new Date(limit.window_start).getTime() + limit.window_duration_seconds * 1000);
                    const isActive = windowEnd > new Date();
                    return (
                      <div key={limit.id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm">{limit.endpoint}</span>
                            <Badge variant={isActive ? "default" : "outline"}>{isActive ? "Active" : "Expired"}</Badge>
                            {pct >= 90 && <Badge variant="destructive">Critical</Badge>}
                            {pct >= 70 && pct < 90 && <Badge variant="secondary">High</Badge>}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {limit.requests_count} / {limit.max_requests_per_window}
                          </span>
                        </div>
                        <Progress value={Math.min(pct, 100)} className="h-2" />
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground block">Window</span>
                            <span className="font-medium">{limit.window_duration_seconds}s</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Resets</span>
                            <span className="font-medium">{isActive ? format(windowEnd, "HH:mm:ss") : "—"}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Last Request</span>
                            <span className="font-medium">{formatDistanceToNow(new Date(limit.last_request_at), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Keys overview */}
        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <CardTitle>API Keys Overview</CardTitle>
              <CardDescription>Activity and status of your API keys</CardDescription>
            </CardHeader>
            <CardContent>
              {apiKeys.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No API keys created yet. Create one in Settings → API.</p>
              ) : (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div key={key.id} className="flex flex-col sm:flex-row sm:items-center justify-between border rounded-lg p-4 gap-3">
                      <div className="flex items-center gap-3">
                        <Key className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div>
                          <p className="font-medium text-sm">{key.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{key.key_prefix}…</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <Badge variant={key.is_active ? "default" : "outline"}>
                          {key.is_active ? "Active" : "Inactive"}
                        </Badge>
                        {key.scopes && key.scopes.length > 0 && (
                          <span className="text-xs text-muted-foreground">{key.scopes.length} scopes</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {key.last_used_at
                            ? `Used ${formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true })}`
                            : "Never used"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
