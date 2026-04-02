import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { TopUpCreditsDialog } from "./TopUpCreditsDialog";
import { CreditAdjustmentHistory } from "./CreditAdjustmentHistory";
import { Coins, AlertTriangle, Gift, TrendingUp, Building2, Infinity as InfinityIcon } from "lucide-react";
import { getPlanDisplayName, isUnlimited } from "@/lib/plan-tiers";

interface OrganizationCredits {
  id: string;
  name: string;
  plan_id: string | null;
  enrichment_credits_used: number;
  enrichment_credits_total: number | null;
  enrichment_credits_bonus: number;
  enrichment_credits_reset_at: string | null;
  usagePercent: number;
}

interface CreditMetrics {
  totalAllocated: number;
  totalUsed: number;
  totalBonus: number;
  orgsAtRisk: number;
  unlimitedOrgs: number;
}

export const CreditManagementDashboard = () => {
  const [organizations, setOrganizations] = useState<OrganizationCredits[]>([]);
  const [metrics, setMetrics] = useState<CreditMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [topUpOrg, setTopUpOrg] = useState<OrganizationCredits | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, plan_id, enrichment_credits_used, enrichment_credits_total, enrichment_credits_bonus, enrichment_credits_reset_at")
        .order("name");

      if (error) throw error;

      const orgsWithUsage = (data || []).map((org) => ({
        ...org,
        enrichment_credits_bonus: org.enrichment_credits_bonus || 0,
        usagePercent: org.enrichment_credits_total 
          ? Math.round((org.enrichment_credits_used / org.enrichment_credits_total) * 100)
          : 0,
      }));

      setOrganizations(orgsWithUsage);

      // Calculate metrics
      const metricsData: CreditMetrics = {
        totalAllocated: orgsWithUsage.reduce((sum, org) => sum + (org.enrichment_credits_total || 0), 0),
        totalUsed: orgsWithUsage.reduce((sum, org) => sum + org.enrichment_credits_used, 0),
        totalBonus: orgsWithUsage.reduce((sum, org) => sum + org.enrichment_credits_bonus, 0),
        orgsAtRisk: orgsWithUsage.filter((org) => org.usagePercent >= 80 && org.enrichment_credits_total !== null).length,
        unlimitedOrgs: orgsWithUsage.filter((org) => org.enrichment_credits_total === null).length,
      };
      setMetrics(metricsData);
    } catch (error) {
      console.error("Error fetching credit data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const atRiskOrgs = organizations
    .filter((org) => org.usagePercent >= 80 && org.enrichment_credits_total !== null)
    .sort((a, b) => b.usagePercent - a.usagePercent);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Total Allocated
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics?.totalAllocated.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Used This Period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics?.totalUsed.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Gift className="h-4 w-4" />
              Bonus Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">{metrics?.totalBonus.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              At Risk (≥80%)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-orange-500">{metrics?.orgsAtRisk}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <InfinityIcon className="h-4 w-4" />
              Unlimited Orgs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{metrics?.unlimitedOrgs}</p>
          </CardContent>
        </Card>
      </div>

      {/* At-Risk Organizations */}
      {atRiskOrgs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Organizations Approaching Limit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Mobile cards */}
            <div className="block sm:hidden space-y-3">
              {atRiskOrgs.map((org) => (
                <div key={org.id} className="border rounded-lg p-3 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{org.name}</span>
                    <Badge variant="outline">{getPlanDisplayName(org.plan_id)}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={org.usagePercent} className="flex-1 h-2" />
                    <span className={`text-sm font-medium ${org.usagePercent >= 90 ? 'text-destructive' : 'text-orange-500'}`}>{org.usagePercent}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{org.enrichment_credits_used}/{org.enrichment_credits_total}</span>
                    <Button size="sm" variant="outline" onClick={() => setTopUpOrg(org)}>
                      <Gift className="h-3 w-3 mr-1" />Top-Up
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <Table className="hidden sm:table">
              <TableHeader>
                <TableRow>
                  <TableHead>Organization</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Plan Usage</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atRiskOrgs.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getPlanDisplayName(org.plan_id)}</Badge>
                    </TableCell>
                    <TableCell>
                      {org.enrichment_credits_used}/{org.enrichment_credits_total}
                    </TableCell>
                    <TableCell>
                      {org.enrichment_credits_bonus > 0 ? (
                        <Badge variant="secondary">{org.enrichment_credits_bonus}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={org.usagePercent} className="w-20 h-2" />
                        <span className={`text-sm font-medium ${org.usagePercent >= 90 ? 'text-red-500' : 'text-orange-500'}`}>
                          {org.usagePercent}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => setTopUpOrg(org)}>
                        <Gift className="h-3 w-3 mr-1" />Top-Up
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* All Organizations Credit Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            All Organizations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Credits Used</TableHead>
                <TableHead>Bonus</TableHead>
                <TableHead>Total Available</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organizations.map((org) => {
                const unlimited = isUnlimited(org.plan_id) || org.enrichment_credits_total === null;
                const planRemaining = unlimited ? Infinity : Math.max(0, (org.enrichment_credits_total || 0) - org.enrichment_credits_used);
                const totalAvailable = unlimited ? "Unlimited" : planRemaining + org.enrichment_credits_bonus;
                
                return (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant={unlimited ? "default" : "outline"}>
                        {getPlanDisplayName(org.plan_id)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {unlimited ? (
                        <span>{org.enrichment_credits_used.toLocaleString()}</span>
                      ) : (
                        <span>{org.enrichment_credits_used}/{org.enrichment_credits_total}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {org.enrichment_credits_bonus > 0 ? (
                        <Badge variant="secondary">{org.enrichment_credits_bonus}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">
                      {unlimited ? (
                        <Badge><InfinityIcon className="h-3 w-3 mr-1" />Unlimited</Badge>
                      ) : (
                        (planRemaining + org.enrichment_credits_bonus).toLocaleString()
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setTopUpOrg(org)}
                      >
                        <Gift className="h-3 w-3 mr-1" />
                        Top-Up
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Credit History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Adjustments</CardTitle>
        </CardHeader>
        <CardContent>
          <CreditAdjustmentHistory limit={25} />
        </CardContent>
      </Card>

      {/* Top-Up Dialog */}
      <TopUpCreditsDialog
        org={topUpOrg}
        open={!!topUpOrg}
        onOpenChange={(open) => !open && setTopUpOrg(null)}
        onSuccess={fetchData}
      />
    </div>
  );
};
