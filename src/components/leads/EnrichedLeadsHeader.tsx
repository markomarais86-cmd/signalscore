import { Download, RefreshCw, UserPlus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EnrichedLead } from "@/hooks/use-enriched-leads";
import { useCampaignContext } from "@/hooks/use-campaign-context";
import { useState } from "react";

interface EnrichedLeadsHeaderProps {
  selectedLeads: EnrichedLead[];
  allLeads: EnrichedLead[];
  orgId: string | null;
  onRefresh: () => void;
  onClearSelection: () => void;
}

export function EnrichedLeadsHeader({
  selectedLeads,
  allLeads,
  orgId,
  onRefresh,
  onClearSelection
}: EnrichedLeadsHeaderProps) {
  const { toast } = useToast();
  const { openCampaignBuilder } = useCampaignContext();
  const [isExporting, setIsExporting] = useState(false);
  const [isReEnriching, setIsReEnriching] = useState(false);

  const hasSelection = selectedLeads.length > 0;

  // Helper to normalize array/JSON fields for CSV
  const normalizeForCSV = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (Array.isArray(value)) return value.join('; ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  // Get phone display from various sources
  const getPhonesDisplay = (lead: EnrichedLead): string => {
    const phones: string[] = [];
    if (lead.direct_phone) phones.push(lead.direct_phone);
    if (lead.phone && lead.phone !== lead.direct_phone) phones.push(lead.phone);
    if (lead.mobile && !phones.includes(lead.mobile)) phones.push(lead.mobile);
    
    // Parse phones JSONB if present
    if (lead.phones) {
      try {
        const phonesData = typeof lead.phones === 'string' ? JSON.parse(lead.phones) : lead.phones;
        if (Array.isArray(phonesData)) {
          phonesData.forEach((p: any) => {
            if (p.number && !phones.includes(p.number)) {
              phones.push(p.number);
            }
          });
        }
      } catch {}
    }
    
    return phones.join('; ');
  };

  const exportToCSV = async (leadsToExport: EnrichedLead[]) => {
    if (leadsToExport.length === 0) {
      toast({
        title: "No leads to export",
        description: "Select leads or ensure there are enriched leads to export",
        variant: "destructive"
      });
      return;
    }

    setIsExporting(true);
    
    try {
      // CSV headers - expanded for full data export
      const headers = [
        'Name', 'First Name', 'Last Name', 'Email', 'Email Verified',
        'Phone(s)', 'Direct Phone', 'Mobile',
        'Title', 'Seniority', 'Department', 'Persona',
        'Company', 'Account ID', 'LinkedIn URL',
        'Enriched At', 'Enrichment Source', 'Enrichment Confidence',
        'ICP Qualified', 'Still at Company', 'External ID'
      ];

      const rows = leadsToExport.map(lead => {
        const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();
        return [
          fullName || lead.name || '',
          lead.first_name || '',
          lead.last_name || '',
          lead.email || '',
          lead.email_verified ? 'Yes' : 'No',
          getPhonesDisplay(lead),
          lead.direct_phone || '',
          lead.mobile || '',
          lead.title || '',
          lead.seniority_level || '',
          lead.department_category || '',
          lead.persona || '',
          lead.company || '',
          lead.account_external_id || '',
          lead.linkedin_url || '',
          lead.enriched_at || '',
          lead.enriched_from || '',
          lead.enrichment_confidence ? `${lead.enrichment_confidence}%` : '',
          lead.icp_qualified ? 'Yes' : 'No',
          lead.still_at_company || '',
          lead.external_id || ''
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${normalizeForCSV(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `enriched_leads_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "Export successful",
        description: `Exported ${leadsToExport.length} enriched leads`
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Could not export leads",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleReEnrich = async () => {
    if (selectedLeads.length === 0 || !orgId) return;

    setIsReEnriching(true);
    
    try {
      // Call the enrich-lead function for each selected lead
      const emails = selectedLeads.map(l => l.email).filter(Boolean);
      
      if (emails.length === 0) {
        toast({
          title: "No valid emails",
          description: "Selected leads don't have email addresses to enrich",
          variant: "destructive"
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('enrich-lead', {
        body: { 
          org_id: orgId, 
          emails,
          force_refresh: true
        }
      });

      if (error) throw error;

      toast({
        title: "Re-enrichment started",
        description: `Processing ${emails.length} leads...`
      });

      // Clear selection and refresh after a delay
      setTimeout(() => {
        onClearSelection();
        onRefresh();
      }, 2000);

    } catch (error) {
      toast({
        title: "Re-enrichment failed",
        description: error instanceof Error ? error.message : "Could not start re-enrichment",
        variant: "destructive"
      });
    } finally {
      setIsReEnriching(false);
    }
  };

  const handleAddToCampaign = () => {
    if (selectedLeads.length === 0) return;

    openCampaignBuilder({
      suggestedCampaignName: `Enriched Leads - ${new Date().toLocaleDateString()}`,
      targetAccountIds: selectedLeads.map(l => l.account_external_id).filter(Boolean) as string[]
    });

    onClearSelection();
  };

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        {hasSelection && (
          <>
            <Badge variant="secondary" className="text-sm">
              {selectedLeads.length} selected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(selectedLeads)}
              disabled={isExporting}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Selected
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReEnrich}
              disabled={isReEnriching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isReEnriching ? 'animate-spin' : ''}`} />
              Re-enrich
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleAddToCampaign}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add to Campaign
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportToCSV(allLeads)}
          disabled={isExporting || allLeads.length === 0}
        >
          <Download className="h-4 w-4 mr-2" />
          Export All ({allLeads.length})
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
