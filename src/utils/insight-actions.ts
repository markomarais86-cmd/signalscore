import { toast } from "sonner";

export interface Account {
  id: string;
  name: string;
  score?: number;
}

export interface Insight {
  id?: string;
  title: string;
  description: string;
  targetAccounts?: Account[];
  nextAction?: 'build_campaign' | 'export_csv' | 'view_accounts' | 'enrich_data' | 'score_accounts';
  relatedSegments?: string[];
}

export interface CampaignFromInsightParams {
  insightTitle: string;
  suggestedCampaignName: string;
  targetAccountIds?: string[];
  filters?: {
    minScore?: number;
    industries?: string[];
    segments?: string[];
  };
}

export const executeInsightAction = async (
  action: string,
  insight: Insight,
  navigate: (path: string) => void,
  openCampaignBuilder?: (context: CampaignFromInsightParams) => void
) => {
  switch (action) {
    case 'build_campaign':
      // If we have a campaign builder opener, use it directly
      if (openCampaignBuilder) {
        const suggestedName = generateCampaignName(insight);
        openCampaignBuilder({
          insightTitle: insight.title,
          suggestedCampaignName: suggestedName,
          targetAccountIds: insight.targetAccounts?.map(a => a.id),
          filters: {
            minScore: 70,
            industries: insight.relatedSegments,
            segments: insight.relatedSegments,
          }
        });
        toast.success("Campaign Builder opened", {
          description: `Pre-loaded with ${insight.targetAccounts?.length || 0} accounts from insight`
        });
        return;
      }
      
      // Fallback to navigation
      const params = new URLSearchParams({
        score_min: '70',
        action: 'export'
      });
      
      if (insight.relatedSegments && insight.relatedSegments.length > 0) {
        params.set('industry', insight.relatedSegments[0]);
      }
      
      navigate(`/accounts?${params.toString()}`);
      toast.success("Campaign list ready", {
        description: `${insight.targetAccounts?.length || 0} high-fit accounts selected`
      });
      break;
      
    case 'export_csv':
      // Navigate to accounts page with export action
      const exportParams = new URLSearchParams({ action: 'export' });
      
      if (insight.relatedSegments && insight.relatedSegments.length > 0) {
        exportParams.set('segment', insight.relatedSegments[0]);
      }
      
      navigate(`/accounts?${exportParams.toString()}`);
      toast.success("Ready to export", {
        description: "Select accounts and click Export to download CSV"
      });
      break;
      
    case 'enrich_data':
      // Navigate to settings with enrichment tab
      const accountIds = insight.targetAccounts?.map(a => a.id).join(',') || '';
      navigate(`/settings?tab=enrichment${accountIds ? `&accounts=${accountIds}` : ''}`);
      toast.info("Opening enrichment settings", {
        description: "Select data providers to enrich account data"
      });
      break;
      
    case 'score_accounts':
      // Navigate to accounts page with score action
      navigate('/accounts?action=score');
      toast.info("Opening accounts", {
        description: "Use Bulk Score to calculate ICP fit scores"
      });
      break;
      
    case 'view_accounts':
    default:
      // Default action: navigate to accounts filtered by segment
      const viewParams = new URLSearchParams();
      
      if (insight.relatedSegments && insight.relatedSegments.length > 0) {
        viewParams.set('segment', insight.relatedSegments[0]);
      }
      
      navigate(`/accounts${viewParams.toString() ? `?${viewParams.toString()}` : ''}`);
      break;
  }
};

export const getActionLabel = (action?: string): string => {
  switch (action) {
    case 'build_campaign':
      return 'Build Campaign';
    case 'export_csv':
      return 'Export CSV';
    case 'enrich_data':
      return 'Enrich Data';
    case 'score_accounts':
      return 'Score Accounts';
    case 'view_accounts':
      return 'View Accounts';
    default:
      return 'View Details';
  }
};

export const getActionIcon = (action?: string): string => {
  switch (action) {
    case 'build_campaign':
      return 'Target';
    case 'export_csv':
      return 'Download';
    case 'enrich_data':
      return 'Sparkles';
    case 'score_accounts':
      return 'Calculator';
    case 'view_accounts':
      return 'Eye';
    default:
      return 'ArrowRight';
  }
};

// Helper to generate campaign name from insight
function generateCampaignName(insight: Insight): string {
  const date = new Date();
  const weekNumber = Math.ceil((date.getDate() - date.getDay() + 1) / 7);
  const monthName = date.toLocaleString('default', { month: 'short' });
  
  // Extract key info from insight title
  let prefix = 'Insight';
  if (insight.title.toLowerCase().includes('high-fit')) {
    prefix = 'HighFit';
  } else if (insight.title.toLowerCase().includes('enrich')) {
    prefix = 'Enriched';
  } else if (insight.title.toLowerCase().includes('score')) {
    prefix = 'Scored';
  } else if (insight.title.toLowerCase().includes('icp')) {
    prefix = 'ICP';
  }
  
  const segment = insight.relatedSegments?.[0] || 'All';
  
  return `${prefix}_${segment}_W${weekNumber}${monthName}`.replace(/\s+/g, '_');
}
