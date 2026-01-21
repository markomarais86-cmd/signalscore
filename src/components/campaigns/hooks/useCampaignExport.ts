import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { FilterCriteria, ICPProfile } from './useCampaignState';
import { SequenceStep } from '../constants/campaign-config';
import { formatNumber } from '@/utils/format-numbers';

interface ExportOptions {
  campaignName: string;
  filterCriteria: FilterCriteria;
  sequenceSteps: SequenceStep[];
  selectedTitles: string[];
  selectedSeniority: string[];
  selectedDepartments: string[];
  provider: 'apollo' | 'zoominfo' | 'clearbit';
  destination: 'salesforce' | 'hubspot' | 'csv' | 'apollo';
  dataSource: 'all' | 'crm' | 'database';
  excludeDuplicates: boolean;
  activeICP: ICPProfile | null;
  previewData: any[] | null;
  estimatedLeads: number;
  duplicateEmails: Set<string>;
}

export function useCampaignExport() {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [isPushing, setIsPushing] = useState(false);
  const [pushComplete, setPushComplete] = useState(false);
  const [crmSyncStatus, setCrmSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  const generateCSV = useCallback(async (accountData: any[] | null): Promise<string> => {
    if (!accountData || accountData.length === 0 || !userProfile?.org_id) {
      throw new Error('No preview data available. Please load the preview first.');
    }
    
    const accountIds = accountData.map((a: any) => a.external_id);
    const allLeads: any[] = [];
    const batchSize = 100;
    
    for (let i = 0; i < accountIds.length; i += batchSize) {
      const batch = accountIds.slice(i, i + batchSize);
      const { data: leads, error } = await supabase
        .from('Leads')
        .select('email, first_name, last_name, title, persona, level, phone, direct_phone, cell_phone, mobile, linkedin_url, account_external_id')
        .eq('org_id', userProfile.org_id)
        .in('account_external_id', batch)
        .not('email', 'is', null);
      
      if (!error && leads) {
        allLeads.push(...leads);
      }
    }
    
    if (allLeads.length === 0) {
      throw new Error('No contacts with email found for selected accounts.');
    }
    
    const accountMap = new Map(accountData.map((a: any) => [a.external_id, a]));
    
    const headers = [
      'Email', 'First Name', 'Last Name', 'Title', 'Phone', 'LinkedIn URL',
      'Company', 'Domain', 'Industry', 'Employee Count', 'Revenue Range',
      'Country', 'State', 'City', 'Persona', 'Seniority',
      'Overall Score', 'Fit Score', 'Score Band', 'Account ID'
    ];
    
    const rows = allLeads.map(lead => {
      const account = accountMap.get(lead.account_external_id) || {};
      const phone = lead.direct_phone || lead.cell_phone || lead.mobile || lead.phone || '';
      const overallScore = account.overall_score || 0;
      const scoreBand = overallScore >= 70 ? 'A' : overallScore >= 40 ? 'B' : 'C';
      
      return [
        lead.email || '',
        lead.first_name || '',
        lead.last_name || '',
        lead.title || '',
        phone,
        lead.linkedin_url || '',
        account.name || '',
        account.domain || '',
        account.industry_norm || '',
        account.employee_count || '',
        account.revenue_range || '',
        account.country || '',
        account.state_province || '',
        account.city || '',
        lead.persona || '',
        lead.level || '',
        overallScore,
        account.fit_score || 0,
        scoreBand,
        lead.account_external_id || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });
    
    return [headers.join(','), ...rows].join('\n');
  }, [userProfile?.org_id]);

  const downloadCSV = useCallback((content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  }, []);

  const createCampaign = useCallback(async (options: ExportOptions) => {
    if (!userProfile?.org_id) return;
    
    const { previewData, excludeDuplicates, duplicateEmails, destination, campaignName, estimatedLeads } = options;
    
    if (!previewData || previewData.length === 0) {
      toast({ title: "No Data", description: "Please load preview data first", variant: "destructive" });
      return;
    }
    
    setIsPushing(true);
    try {
      let finalAccounts = previewData || [];
      if (excludeDuplicates && duplicateEmails.size > 0) {
        finalAccounts = finalAccounts.filter((account: any) => 
          !duplicateEmails.has(account.email)
        );
      }

      const campaignData = {
        org_id: userProfile.org_id,
        icp_id: options.activeICP?.id,
        campaign_name: campaignName,
        filter_criteria: options.filterCriteria,
        sequence_steps: options.sequenceSteps,
        persona_criteria: {
          titles: options.selectedTitles,
          seniority: options.selectedSeniority,
          departments: options.selectedDepartments
        },
        provider: options.provider,
        destination,
        data_source: options.dataSource,
        contacts: finalAccounts,
        batch_metadata: {
          source_accounts: previewData?.length || 0,
          icp_id: options.activeICP?.id,
          icp_name: options.activeICP?.name || 'Custom Campaign',
          icp_criteria: options.filterCriteria,
          persona_criteria: {
            titles: options.selectedTitles,
            seniority: options.selectedSeniority,
            departments: options.selectedDepartments
          }
        }
      };

      if (destination === 'salesforce') {
        setCrmSyncStatus('syncing');
        const { error } = await supabase.functions.invoke('push-campaign-to-crm', {
          body: campaignData
        });
        if (error) {
          setCrmSyncStatus('error');
          throw error;
        }
        setCrmSyncStatus('success');
        toast({ title: "Campaign Created", description: `Successfully pushed ${formatNumber(estimatedLeads)} leads to Salesforce` });
        setPushComplete(true);
      } else if (destination === 'hubspot') {
        setCrmSyncStatus('syncing');
        const { error } = await supabase.functions.invoke('hubspot-sync', {
          body: { ...campaignData, action: 'push_campaign' }
        });
        if (error) {
          setCrmSyncStatus('error');
          throw error;
        }
        setCrmSyncStatus('success');
        toast({ title: "Campaign Created", description: `Successfully pushed ${formatNumber(estimatedLeads)} contacts to HubSpot` });
        setPushComplete(true);
      } else {
        // CSV Export
        try {
          const csvContent = await generateCSV(previewData);
          if (!csvContent || csvContent.split('\n').length <= 1) {
            throw new Error('No leads found to export.');
          }
          downloadCSV(csvContent, `${campaignName || 'campaign'}.csv`);
          const rowCount = csvContent.split('\n').length - 1;
          toast({ title: "Campaign Exported", description: `Downloaded ${rowCount} leads as CSV` });
          setPushComplete(true);
        } catch (csvError: any) {
          toast({ 
            title: "Export Failed", 
            description: csvError.message || "Failed to generate CSV file",
            variant: "destructive" 
          });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to create campaign", variant: "destructive" });
    } finally {
      setIsPushing(false);
    }
  }, [userProfile?.org_id, toast, generateCSV, downloadCSV]);

  const reset = useCallback(() => {
    setIsPushing(false);
    setPushComplete(false);
    setCrmSyncStatus('idle');
  }, []);

  return {
    isPushing,
    pushComplete,
    crmSyncStatus,
    createCampaign,
    generateCSV,
    downloadCSV,
    reset
  };
}
