import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OrganizationMetrics } from "@/hooks/use-platform-admin";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";

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
  const [status, setStatus] = useState(org?.status || 'active');
  const [creditLimit, setCreditLimit] = useState(org?.enrichment_credits_total || 1000);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!org) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          status,
          enrichment_credits_total: creditLimit
        })
        .eq("id", org.id);

      if (error) throw error;

      // Log audit event
      await supabase.from("audit_logs").insert({
        org_id: org.id,
        actor: "super_admin",
        action: "organization_updated",
        meta: { status, creditLimit }
      });

      toast.success("Organization updated successfully");
      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
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
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">Users</p>
              <p className="text-2xl font-bold">{org.total_users}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Accounts</p>
              <p className="text-2xl font-bold">{org.total_accounts}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Credits Used</p>
              <p className="text-2xl font-bold">{org.enrichment_credits_used}</p>
            </div>
          </div>

          <div className="space-y-4">
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

            <div>
              <Label htmlFor="credits">Enrichment Credit Limit</Label>
              <Input
                id="credits"
                type="number"
                value={creditLimit}
                onChange={(e) => setCreditLimit(parseInt(e.target.value))}
              />
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
