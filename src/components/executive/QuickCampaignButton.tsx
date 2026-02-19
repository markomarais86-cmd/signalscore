import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Rocket, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { toastError } from "@/lib/friendly-errors";
import { getScoreBand } from "@/lib/score-bands";

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

      // Get high-fit accounts with contacts and full firmographic data
      const { data: accounts, error: accountsError } = await supabase
        .from('accounts')
        .select(`
          external_id,
          name,
          domain,
          industry_norm,
          employee_count,
          revenue_range,
          country,
          state_province,
          city,
          Leads!inner (
            id,
            email,
            first_name,
            last_name,
            title,
            persona,
            phone,
            direct_phone,
            cell_phone,
            mobile,
            linkedin_url,
            level
          )
        `)
        .eq('org_id', userProfile.org_id)
        .eq('Leads.org_id', userProfile.org_id)
        .neq('Leads.email', null)
        .limit(500);

      if (accountsError) throw accountsError;

      // Get scores for all accounts
      const { data: scoresData, error: scoresError } = await supabase
        .from('scores')
        .select('account_external_id, overall, fit, intent')
        .eq('org_id', userProfile.org_id)
        .in('account_external_id', accounts?.map(a => a.external_id) || []);

      if (scoresError) throw scoresError;

      // Create score map and filter high-fit accounts (score >= 70)
      const scoreMap = new Map(scoresData?.map(s => [s.account_external_id, s]) || []);
      const filteredAccounts = accounts?.filter(a => {
        const score = scoreMap.get(a.external_id);
        return score && score.overall >= 70;
      });

      if (!filteredAccounts || filteredAccounts.length === 0) {
        toast.error("No high-fit accounts with contacts found");
        setLoading(false);
        return;
      }

      // Helper to get best phone number
      const getBestPhone = (lead: any) => 
        lead.direct_phone || lead.cell_phone || lead.mobile || lead.phone || '';

      // Helper to calculate score band

      // Prepare contacts with full intelligence
      const contacts = filteredAccounts.flatMap(account => {
        const score = scoreMap.get(account.external_id);
        return account.Leads.map((lead: any) => ({
          email: lead.email,
          first_name: lead.first_name || '',
          last_name: lead.last_name || '',
          title: lead.title || '',
          phone: getBestPhone(lead),
          linkedin_url: lead.linkedin_url || '',
          company: account.name || '',
          domain: account.domain || '',
          industry: account.industry_norm || '',
          employee_count: account.employee_count || '',
          revenue_range: account.revenue_range || '',
          country: account.country || '',
          state: account.state_province || '',
          city: account.city || '',
          persona: lead.persona || '',
          seniority: lead.level || '',
          overall_score: score?.overall || '',
          fit_score: score?.fit || '',
          score_band: getScoreBand(score?.overall),
          account_id: account.external_id
        }));
      }).slice(0, 500);

      // Generate campaign name
      const campaignName = `High-Fit Campaign - ${icp.name} - ${new Date().toLocaleDateString()}`;

      // Helper function to export as CSV with full intelligence
      const exportAsCSV = () => {
        const headers = [
          'Email', 'First Name', 'Last Name', 'Title', 'Phone', 'LinkedIn URL',
          'Company', 'Domain', 'Industry', 'Employee Count', 'Revenue Range',
          'Country', 'State', 'City', 'Persona', 'Seniority',
          'Overall Score', 'Fit Score', 'Score Band', 'Account ID'
        ];
        const csv = [
          headers.join(','),
          ...contacts.map(c => [
            c.email,
            c.first_name,
            c.last_name,
            c.title,
            c.phone,
            c.linkedin_url,
            c.company,
            c.domain,
            c.industry,
            c.employee_count,
            c.revenue_range,
            c.country,
            c.state,
            c.city,
            c.persona,
            c.seniority,
            c.overall_score,
            c.fit_score,
            c.score_band,
            c.account_id
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${campaignName}.csv`;
        a.click();
      };

      // Check for Salesforce integration
      const { data: sfConfig } = await supabase
        .from('integration_configs')
        .select('id')
        .eq('org_id', userProfile.org_id)
        .eq('provider_name', 'salesforce')
        .eq('status', 'connected')
        .maybeSingle();

      if (sfConfig) {
        // Try to push to Salesforce, fall back to CSV on error
        try {
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
        } catch (sfError: any) {
          console.warn('Salesforce push failed, falling back to CSV:', sfError);
          exportAsCSV();
          toast.success(`Salesforce unavailable. Campaign exported as CSV with ${contacts.length} contacts!`);
        }
      } else {
        // Export as CSV
        exportAsCSV();
        toast.success(`Campaign exported with ${contacts.length} contacts!`);
      }

      setOpen(false);
    } catch (error: any) {
      console.error('Quick campaign error:', error);
      toast.error(toastError(error, 'Failed to create campaign'));
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
