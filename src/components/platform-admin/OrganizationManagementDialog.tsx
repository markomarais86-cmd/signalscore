import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OrganizationMetrics } from "@/hooks/use-platform-admin";
import { AlertCircle, CheckCircle, XCircle, Building2, Users, Database, Layers } from "lucide-react";
import { toastError } from "@/lib/friendly-errors";
import { PLAN_TIER_LIST, getPlanTierFromId, getPlanUuid, getPlanTierFromUuid, type PlanTier } from "@/lib/plan-tiers";
import { useQueryClient } from "@tanstack/react-query";

interface OrganizationManagementDialogProps {
  org: OrganizationMetrics | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export const OrganizationManagementDialog = ({
  org,
  open,
  onOpenChange,
  onUpdate
}: OrganizationManagementDialogProps) => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(org?.status || 'active');
  const [serviceType, setServiceType] = useState<'managed' | 'self_service'>(
    (org as any)?.service_type || 'self_service'
  );
  // Convert database UUID to tier name for display/selection
  const [planTier, setPlanTier] = useState<PlanTier>(getPlanTierFromUuid(org?.plan_id) || 'free');
  const [creditLimit, setCreditLimit] = useState(org?.enrichment_credits_total || 1000);
  const [loading, setLoading] = useState(false);

  // Update state when org changes - convert UUID to tier name
  useEffect(() => {
    if (org) {
      setStatus(org.status || 'active');
      setServiceType((org as any)?.service_type || 'self_service');
      setPlanTier(getPlanTierFromUuid(org.plan_id) || 'free');
      setCreditLimit(org.enrichment_credits_total || 1000);
    }
  }, [org]);

  const selectedPlan = getPlanTierFromId(planTier);

  const handleSave = async () => {
    if (!org) return;
    
    setLoading(true);
    try {
      // Convert tier name back to UUID for database storage
      const planUuid = getPlanUuid(planTier);
      
      const { error } = await supabase
        .from("organizations")
        .update({
          status,
          service_type: serviceType,
          plan_id: planUuid,
          enrichment_credits_total: creditLimit
        })
        .eq("id", org.id);

      if (error) throw error;

      // Log audit event
      await supabase.from("audit_logs").insert({
        org_id: org.id,
        actor: "super_admin",
        action: "organization_updated",
        meta: { status, serviceType, planTier, planUuid, creditLimit }
      });

      // Invalidate React Query cache to refresh the organization list
      await queryClient.invalidateQueries({ queryKey: ["platform-admin-organizations"] });
      await queryClient.invalidateQueries({ queryKey: ["platform-admin-metrics"] });
      
      toast.success("Organization updated successfully");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Failed to update organization:', error);
      toast.error(toastError(error, 'Failed to update organization'));
    } finally {
      setLoading(false);
    }
  };

  if (!org) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage {org.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Metrics Overview */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Users</p>
                <p className="text-xl font-bold">{org.total_users}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Accounts</p>
                <p className="text-xl font-bold">{org.total_accounts}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Credits Used</p>
                <p className="text-xl font-bold">{org.enrichment_credits_used}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-xl font-bold">{selectedPlan.displayName}</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {/* Service Type */}
            <div>
              <Label htmlFor="serviceType">Service Type</Label>
              <Select value={serviceType} onValueChange={(v) => setServiceType(v as 'managed' | 'self_service')}>
                <SelectTrigger id="serviceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="managed">Managed (Consulting)</SelectItem>
                  <SelectItem value="self_service">Self-Service (Platform)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Managed: read-only dashboard. Self-service: full platform tools.
              </p>
            </div>

            {/* Plan Selection */}
            <div>
              <Label htmlFor="plan">Plan Tier</Label>
              <Select value={planTier} onValueChange={(value) => setPlanTier(value as PlanTier)}>
                <SelectTrigger id="plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_TIER_LIST.map((tier) => (
                    <SelectItem key={tier.id} value={tier.id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{tier.displayName}</span>
                        <span className="text-muted-foreground text-xs">
                          ({tier.limits.maxAccounts ? `${tier.limits.maxAccounts.toLocaleString()} accounts` : 'unlimited'})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Plan limits: {selectedPlan.limits.maxIcpModels ?? '∞'} ICP models, {selectedPlan.limits.maxIntegrations ?? '∞'} integrations, {selectedPlan.limits.historyMonths ?? 'full'} months history
              </p>
            </div>

            {/* Organization Status */}
            <div>
              <Label htmlFor="status">Organization Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Active
                    </div>
                  </SelectItem>
                  <SelectItem value="suspended">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                      Suspended
                    </div>
                  </SelectItem>
                  <SelectItem value="inactive">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-600" />
                      Inactive
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Credit Limit Override */}
            <div>
              <Label htmlFor="credits">Enrichment Credit Limit (Override)</Label>
              <Input
                id="credits"
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(parseInt(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Default for {selectedPlan.displayName}: {selectedPlan.monthlyEnrichmentCredits.toLocaleString()} credits/month
              </p>
            </div>
          </div>

          {/* Plan Features Summary */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-2">Plan Features</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex items-center gap-1">
                {selectedPlan.features.crmSync ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
                CRM Sync
              </div>
              <div className="flex items-center gap-1">
                {selectedPlan.features.multiRegion ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
                Multi-Region
              </div>
              <div className="flex items-center gap-1">
                {selectedPlan.features.benchmarking ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
                Benchmarking
              </div>
              <div className="flex items-center gap-1">
                {selectedPlan.features.subIndustry ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
                Sub-Industry
              </div>
              <div className="flex items-center gap-1">
                {selectedPlan.features.apiAccess ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
                API Access
              </div>
              <div className="flex items-center gap-1">
                {selectedPlan.features.sso ? (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                ) : (
                  <XCircle className="h-3 w-3 text-muted-foreground" />
                )}
                SSO
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
