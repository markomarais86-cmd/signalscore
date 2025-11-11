import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CampaignReadyBreakdown {
  total: number;
  crm: number;
  database: number;
  preview: Array<{
    id: string;
    name: string;
    company: string;
    title: string;
    email: string;
    data_source: string;
  }>;
}

export function useCampaignReady(
  orgId: string | undefined,
  sourceFilter: 'all' | 'crm' | 'database'
) {
  return useQuery({
    queryKey: ['campaign-ready', orgId, sourceFilter],
    queryFn: async (): Promise<CampaignReadyBreakdown> => {
      if (!orgId) throw new Error('Organization ID required');

      // Query campaign-ready leads directly with proper filters
      let allQuery = supabase
        .from('Leads')
        .select('id, name, first_name, last_name, company, title, email, persona, data_source')
        .eq('org_id', orgId)
        .not('email', 'is', null)
        .not('title', 'is', null)
        .not('persona', 'is', null);

      // Apply source filter
      if (sourceFilter === 'crm') {
        allQuery = allQuery.eq('data_source', 'crm');
      } else if (sourceFilter === 'database') {
        allQuery = allQuery.eq('data_source', 'database');
      }

      const { data: allLeads, error: allError } = await allQuery;
      if (allError) throw allError;

      // Get CRM count
      const { count: crmCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('data_source', 'crm')
        .not('email', 'is', null)
        .not('title', 'is', null)
        .not('persona', 'is', null);

      // Get Database count
      const { count: databaseCount } = await supabase
        .from('Leads')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('data_source', 'database')
        .not('email', 'is', null)
        .not('title', 'is', null)
        .not('persona', 'is', null);

      // Format preview data (top 10)
      const preview = (allLeads || []).slice(0, 10).map(lead => ({
        id: lead.id.toString(),
        name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.name || 'Unknown',
        company: lead.company || 'Unknown',
        title: lead.title || 'Unknown',
        email: lead.email || '',
        data_source: lead.data_source || 'unknown'
      }));

      return {
        total: allLeads?.length || 0,
        crm: crmCount || 0,
        database: databaseCount || 0,
        preview
      };
    },
    enabled: !!orgId
  });
}
