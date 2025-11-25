import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Rocket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

interface QuickCampaignButtonProps {
  highFitAccounts: number;
  disabled?: boolean;
}

export function QuickCampaignButton({ highFitAccounts, disabled }: QuickCampaignButtonProps) {
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleQuickCampaign = async () => {
    if (!userProfile?.org_id) {
      toast.error("Organization not found");
      return;
    }

    setLoading(true);
    try {
      // Get primary ICP
      const { data: icp } = await supabase
        .from('icp_profiles')
        .select('id, name')
        .eq('org_id', userProfile.org_id)
        .eq('is_primary', true)
        .maybeSingle();

      if (!icp) {
        toast.error("No primary ICP found. Please create an ICP first.");
        setLoading(false);
        return;
      }

      // Get high-fit accounts with contacts
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select(`
          external_id,
          name,
          domain,
          Leads!inner (
            id,
            email,
            first_name,
            last_name,
            title,
            persona
          )
        `)
        .eq('org_id', userProfile.org_id)
        .eq('Leads.org_id', userProfile.org_id)
        .neq('Leads.email', null)
        .limit(500);

      if (accountsError) throw accountsError;

      // Filter accounts with scores >= 70
      const { data: highFitAccountsData, error: scoresError } = await supabase
        .from('scores')
        .select('account_external_id')
        .eq('org_id', userProfile.org_id)
        .gte('overall', 70)
        .in('account_external_id', accounts?.map(a => a.external_id) || []);

      if (scoresError) throw scoresError;

      const highFitExternalIds = new Set(highFitAccountsData?.map(s => s.account_external_id));
      const filteredAccounts = accounts?.filter(a => highFitExternalIds.has(a.external_id));

      if (!filteredAccounts || filteredAccounts.length === 0) {
        toast.error("No high-fit accounts with contacts found");
        setLoading(false);
        return;
      }

      // Prepare contacts for campaign
      const contacts = filteredAccounts.flatMap(account => 
        account.Leads.map((lead: any) => ({
          email: lead.email,
          first_name: lead.first_name,
          last_name: lead.last_name,
          title: lead.title,
          company: account.name,
          persona: lead.persona
        }))
      ).slice(0, 500); // Limit to 500 contacts

      // Generate campaign name
      const campaignName = `High-Fit Campaign - ${icp.name} - ${new Date().toLocaleDateString()}`;

      // Check for Salesforce integration
      const { data: sfConfig } = await supabase
        .from('integration_configs')
        .select('id')
        .eq('org_id', userProfile.org_id)
        .eq('provider_name', 'salesforce')
        .eq('status', 'connected')
        .maybeSingle();

      if (sfConfig) {
        // Push to Salesforce
        const { error: pushError } = await supabase.functions.invoke('push-campaign-to-crm', {
          body: {
            org_id: userProfile.org_id,
            campaign_name: campaignName,
            contacts,
            batch_metadata: {
              icp_id: icp.id,
              icp_name: icp.name,
              source_accounts: filteredAccounts.length
            }
          }
        });

        if (pushError) throw pushError;

        toast.success(`Campaign "${campaignName}" created in Salesforce with ${contacts.length} contacts!`);
      } else {
        // Export as CSV
        const csv = [
          ['Email', 'First Name', 'Last Name', 'Title', 'Company', 'Persona'].join(','),
          ...contacts.map(c => [
            c.email,
            c.first_name || '',
            c.last_name || '',
            c.title || '',
            c.company || '',
            c.persona || ''
          ].join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${campaignName}.csv`;
        a.click();

        toast.success(`Campaign exported with ${contacts.length} contacts!`);
      }

      setOpen(false);
    } catch (error: any) {
      console.error('Quick campaign error:', error);
      toast.error(error.message || 'Failed to create campaign');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        disabled={disabled || highFitAccounts === 0}
        className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
      >
        <Rocket className="mr-2 h-4 w-4" />
        Quick Campaign
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch Quick Campaign</DialogTitle>
            <DialogDescription>
              Create a campaign with your top {Math.min(highFitAccounts, 500)} high-fit accounts using default settings.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Target Accounts:</span>
                <span className="font-medium">High-Fit (Score ≥ 70)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Max Contacts:</span>
                <span className="font-medium">500</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Personas:</span>
                <span className="font-medium">All with valid email</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Destination:</span>
                <span className="font-medium">Salesforce or CSV Export</span>
              </div>
            </div>

            <Button
              onClick={handleQuickCampaign}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Campaign...
                </>
              ) : (
                <>
                  <Rocket className="mr-2 h-4 w-4" />
                  Launch Campaign Now
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
