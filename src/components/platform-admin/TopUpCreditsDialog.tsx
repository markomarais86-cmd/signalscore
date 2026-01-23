import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gift, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TopUpCreditsDialogProps {
  org: {
    id: string;
    name: string;
    enrichment_credits_used: number;
    enrichment_credits_total: number | null;
    enrichment_credits_bonus: number;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const PRESET_AMOUNTS = [50, 100, 250, 500, 1000];

export const TopUpCreditsDialog = ({
  org,
  open,
  onOpenChange,
  onSuccess,
}: TopUpCreditsDialogProps) => {
  const [amount, setAmount] = useState<number>(100);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddCredits = async () => {
    if (!org) return;
    
    if (!reason.trim()) {
      toast.error("Please provide a reason for adding credits");
      return;
    }

    if (amount <= 0) {
      toast.error("Please enter a valid credit amount");
      return;
    }

    setLoading(true);
    try {
      const previousBonus = org.enrichment_credits_bonus || 0;
      const newBonus = previousBonus + amount;

      // Update the organization's bonus credits
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ enrichment_credits_bonus: newBonus })
        .eq("id", org.id);

      if (updateError) throw updateError;

      // Log the adjustment
      const { error: logError } = await supabase
        .from("credit_adjustments")
        .insert({
          org_id: org.id,
          adjustment_type: "top_up",
          previous_bonus: previousBonus,
          new_bonus: newBonus,
          previous_used: org.enrichment_credits_used,
          new_used: org.enrichment_credits_used,
          previous_total: org.enrichment_credits_total,
          new_total: org.enrichment_credits_total,
          credits_added: amount,
          reason: reason.trim(),
          performed_by: "admin", // In production, use actual admin ID
        });

      if (logError) {
        console.error("Error logging adjustment:", logError);
      }

      toast.success(`Added ${amount} bonus credits to ${org.name}`);
      onSuccess();
      onOpenChange(false);
      setAmount(100);
      setReason("");
    } catch (error: any) {
      toast.error(error.message || "Failed to add credits");
    } finally {
      setLoading(false);
    }
  };

  if (!org) return null;

  const planRemaining = org.enrichment_credits_total !== null 
    ? Math.max(0, org.enrichment_credits_total - org.enrichment_credits_used)
    : null;
  const currentBonus = org.enrichment_credits_bonus || 0;
  const totalAvailable = planRemaining !== null 
    ? planRemaining + currentBonus 
    : "Unlimited";
  const newTotalAvailable = planRemaining !== null 
    ? planRemaining + currentBonus + amount 
    : "Unlimited";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Add Bonus Credits
          </DialogTitle>
          <DialogDescription>
            Grant free bonus credits to {org.name}. Bonus credits are used before plan credits and don't reset monthly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Balance */}
          <div className="p-4 bg-muted rounded-lg space-y-2">
            <p className="text-sm font-medium">Current Balance</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Plan Credits:</span>
                <span className="ml-2 font-medium">
                  {org.enrichment_credits_total !== null 
                    ? `${org.enrichment_credits_used}/${org.enrichment_credits_total} used`
                    : "Unlimited"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Bonus Credits:</span>
                <Badge variant="secondary" className="ml-2">{currentBonus}</Badge>
              </div>
            </div>
            <div className="pt-2 border-t">
              <span className="text-muted-foreground">Total Available:</span>
              <span className="ml-2 font-bold text-primary">{totalAvailable}</span>
            </div>
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="amount">Credits to Add</Label>
            <Input
              id="amount"
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(parseInt(e.target.value) || 0)}
              placeholder="Enter amount"
            />
            
            {/* Preset Buttons */}
            <div className="flex flex-wrap gap-2 pt-2">
              {PRESET_AMOUNTS.map((preset) => (
                <Button
                  key={preset}
                  type="button"
                  variant={amount === preset ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAmount(preset)}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {preset}
                </Button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (required)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer compensation for API downtime, Trial extension, Promotional credits..."
              rows={3}
            />
          </div>

          {/* Preview */}
          {amount > 0 && (
            <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
              <p className="text-sm">
                <span className="text-muted-foreground">New Total Available:</span>
                <span className="ml-2 font-bold text-primary">{newTotalAvailable}</span>
                <span className="text-muted-foreground ml-1">
                  (+{amount} bonus)
                </span>
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCredits} disabled={loading || !reason.trim()}>
              {loading ? "Adding..." : `Add ${amount} Credits`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
