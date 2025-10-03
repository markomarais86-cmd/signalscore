import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { LoadingState } from "@/components/LoadingState";

interface RateLimit {
  id: string;
  endpoint: string;
  requests_count: number;
  max_requests_per_window: number;
  window_duration_seconds: number;
  window_start: string;
  last_request_at: string;
}

export function RateLimitSettings() {
  const [limits, setLimits] = useState<RateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile?.org_id) {
      loadRateLimits();
    }
  }, [userProfile?.org_id]);

  const loadRateLimits = async () => {
    if (!userProfile?.org_id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('rate_limits')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('last_request_at', { ascending: false });

      if (error) throw error;
      setLimits(data || []);
    } catch (error) {
      console.error('Error loading rate limits:', error);
      toast({
        title: "Error",
        description: "Failed to load rate limit configuration",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateUsagePercentage = (limit: RateLimit) => {
    return Math.round((limit.requests_count / limit.max_requests_per_window) * 100);
  };

  const getUsageStatus = (percentage: number) => {
    if (percentage >= 90) return { color: 'bg-destructive', label: 'Critical' };
    if (percentage >= 70) return { color: 'bg-warning', label: 'High' };
    return { color: 'bg-success', label: 'Normal' };
  };

  if (loading) {
    return <LoadingState message="Loading rate limit settings..." />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          <CardTitle>Rate Limiting</CardTitle>
        </div>
        <CardDescription>
          Monitor and manage API rate limits for your organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg bg-muted p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">About Rate Limiting</p>
            <p className="text-sm text-muted-foreground">
              Rate limits protect your edge functions from abuse and ensure fair usage across your organization.
              Limits automatically reset after the window duration.
            </p>
          </div>
        </div>

        {limits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No API calls made yet. Rate limits will appear here once endpoints are accessed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {limits.map((limit) => {
              const usagePercent = calculateUsagePercentage(limit);
              const status = getUsageStatus(usagePercent);
              const windowEnd = new Date(
                new Date(limit.window_start).getTime() + limit.window_duration_seconds * 1000
              );
              const isActive = windowEnd > new Date();

              return (
                <div key={limit.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{limit.endpoint}</span>
                      <Badge variant={isActive ? "default" : "outline"}>
                        {isActive ? 'Active' : 'Expired'}
                      </Badge>
                      <Badge variant="outline" className={status.color}>
                        {status.label}
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {limit.requests_count} / {limit.max_requests_per_window} requests
                    </span>
                  </div>

                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${status.color}`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Window</div>
                      <div className="font-medium">{limit.window_duration_seconds}s</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Resets At</div>
                      <div className="font-medium">
                        {windowEnd.toLocaleTimeString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Last Request</div>
                      <div className="font-medium">
                        {new Date(limit.last_request_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="pt-4 border-t">
          <h4 className="font-medium mb-3">Default Rate Limits</h4>
          <div className="grid gap-3">
            <div className="flex justify-between items-center">
              <Label>Bulk Scoring</Label>
              <span className="text-sm text-muted-foreground">10 requests / minute</span>
            </div>
            <div className="flex justify-between items-center">
              <Label>Account Enrichment</Label>
              <span className="text-sm text-muted-foreground">30 requests / minute</span>
            </div>
            <div className="flex justify-between items-center">
              <Label>ICP Analysis</Label>
              <span className="text-sm text-muted-foreground">20 requests / minute</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
