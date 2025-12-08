import { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Loader2, 
  DollarSign, 
  Clock, 
  Database, 
  Users, 
  Building2,
  Zap,
  Download,
  Upload,
  Target,
  RefreshCw,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface ActionPreviewData {
  action: string;
  parameters: Record<string, any>;
  // Preview data
  affectedAccounts?: number;
  affectedContacts?: number;
  estimatedContacts?: number;
  estimatedTime?: string;
  estimatedCredits?: number;
  estimatedCost?: string;
  // Risk assessment
  riskLevel: 'low' | 'medium' | 'high';
  reversible: boolean;
  requiresConfirmation: boolean;
  // Description
  summary: string;
  details?: string[];
  warnings?: string[];
}

interface ActionPreviewProps {
  preview: ActionPreviewData;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  enrich_accounts: <Database className="w-4 h-4" />,
  enrich_contacts: <Users className="w-4 h-4" />,
  export_list: <Download className="w-4 h-4" />,
  create_campaign: <Target className="w-4 h-4" />,
  trigger_scoring: <Zap className="w-4 h-4" />,
  update_icp: <RefreshCw className="w-4 h-4" />,
  sync_to_crm: <Upload className="w-4 h-4" />,
  schedule_enrichment: <Clock className="w-4 h-4" />,
};

const ACTION_LABELS: Record<string, string> = {
  enrich_accounts: 'Enrich Accounts',
  enrich_contacts: 'Enrich Contacts',
  export_list: 'Export List',
  create_campaign: 'Create Campaign',
  trigger_scoring: 'Trigger Scoring',
  update_icp: 'Update ICP',
  sync_to_crm: 'Sync to CRM',
  schedule_enrichment: 'Schedule Enrichment',
};

const RISK_COLORS: Record<string, string> = {
  low: 'bg-[hsl(var(--status-success))]/10 text-[hsl(var(--status-success))] border-[hsl(var(--status-success))]/20',
  medium: 'bg-[hsl(var(--status-warning))]/10 text-[hsl(var(--status-warning))] border-[hsl(var(--status-warning))]/20',
  high: 'bg-destructive/10 text-destructive border-destructive/20',
};

export function ActionPreview({ preview, onConfirm, onCancel, isLoading }: ActionPreviewProps) {
  const [showDetails, setShowDetails] = useState(false);
  
  const icon = ACTION_ICONS[preview.action] || <Zap className="w-4 h-4" />;
  const label = ACTION_LABELS[preview.action] || preview.action;
  
  return (
    <div className="bg-card border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border-b">
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-sm">{label}</h4>
          <p className="text-xs text-muted-foreground">{preview.summary}</p>
        </div>
        <Badge variant="outline" className={cn('text-xs', RISK_COLORS[preview.riskLevel])}>
          {preview.riskLevel === 'low' && <Shield className="w-3 h-3 mr-1" />}
          {preview.riskLevel === 'medium' && <AlertTriangle className="w-3 h-3 mr-1" />}
          {preview.riskLevel === 'high' && <AlertTriangle className="w-3 h-3 mr-1" />}
          {preview.riskLevel} risk
        </Badge>
      </div>
      
      {/* Impact Summary */}
      <div className="px-4 py-3 space-y-3">
        {/* Stats Row */}
        <div className="flex flex-wrap gap-3">
          {preview.affectedAccounts !== undefined && (
            <div className="flex items-center gap-1.5 text-xs">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span><strong>{preview.affectedAccounts.toLocaleString()}</strong> accounts</span>
            </div>
          )}
          {preview.affectedContacts !== undefined && (
            <div className="flex items-center gap-1.5 text-xs">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span><strong>{preview.affectedContacts.toLocaleString()}</strong> contacts</span>
            </div>
          )}
          {preview.estimatedTime && (
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span>~{preview.estimatedTime}</span>
            </div>
          )}
          {(preview.estimatedCredits || preview.estimatedCost) && (
            <div className="flex items-center gap-1.5 text-xs">
              <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
              <span>
                {preview.estimatedCredits ? `${preview.estimatedCredits} credits` : preview.estimatedCost}
              </span>
            </div>
          )}
        </div>
        
        {/* Warnings */}
        {preview.warnings && preview.warnings.length > 0 && (
          <div className="bg-[hsl(var(--status-warning))]/10 rounded-md p-2.5 text-xs">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-[hsl(var(--status-warning))] flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                {preview.warnings.map((warning, i) => (
                  <p key={i} className="text-[hsl(var(--status-warning))]">{warning}</p>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Details (expandable) */}
        {preview.details && preview.details.length > 0 && (
          <div>
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="text-xs text-primary hover:underline"
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            {showDetails && (
              <div className="mt-2 p-2 bg-muted rounded text-xs space-y-1">
                {preview.details.map((detail, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Reversibility note */}
        <p className="text-xs text-muted-foreground">
          {preview.reversible 
            ? '✓ This action can be undone'
            : '⚠ This action cannot be undone'
          }
        </p>
      </div>
      
      {/* Actions */}
      <div className="flex gap-2 px-4 py-3 bg-muted/30 border-t">
        <Button 
          onClick={onConfirm} 
          disabled={isLoading}
          className="flex-1"
          size="sm"
          variant={preview.riskLevel === 'high' ? 'destructive' : 'default'}
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
          ) : (
            <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
          )}
          {preview.riskLevel === 'high' ? 'Confirm & Execute' : 'Execute'}
        </Button>
        <Button 
          onClick={onCancel} 
          disabled={isLoading}
          variant="outline"
          size="sm"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

// Helper to generate preview data from action parameters
export function generateActionPreview(
  action: string, 
  parameters: Record<string, any>
): ActionPreviewData {
  const basePreview: Partial<ActionPreviewData> = {
    action,
    parameters,
  };
  
  switch (action) {
    case 'enrich_accounts':
      return {
        ...basePreview,
        action,
        parameters,
        summary: `Enrich ${parameters.account_ids?.length || 'selected'} accounts with firmographic data`,
        affectedAccounts: parameters.account_ids?.length || 0,
        estimatedCredits: (parameters.account_ids?.length || 0) * 2,
        estimatedTime: `${Math.ceil((parameters.account_ids?.length || 0) / 10)} minutes`,
        riskLevel: 'low',
        reversible: false,
        requiresConfirmation: true,
        details: [
          `Enrichment type: ${parameters.enrichment_type || 'firmographics'}`,
          `Provider: ${parameters.provider || 'auto-select'}`,
        ],
      };
      
    case 'enrich_contacts':
      return {
        ...basePreview,
        action,
        parameters,
        summary: `Discover and enrich contacts for ${parameters.account_ids?.length || 'selected'} accounts`,
        affectedAccounts: parameters.account_ids?.length || 0,
        estimatedContacts: (parameters.account_ids?.length || 0) * (parameters.max_per_account || 5),
        estimatedCredits: (parameters.account_ids?.length || 0) * 5,
        estimatedTime: `${Math.ceil((parameters.account_ids?.length || 0) / 5)} minutes`,
        riskLevel: 'low',
        reversible: false,
        requiresConfirmation: true,
        details: [
          `Target personas: ${parameters.personas?.join(', ') || 'All'}`,
          `Max contacts per account: ${parameters.max_per_account || 5}`,
        ],
      };
      
    case 'export_list':
      return {
        ...basePreview,
        action,
        parameters,
        summary: `Export ${parameters.type || 'records'} to CSV`,
        affectedAccounts: parameters.type === 'accounts' ? parameters.count || 0 : undefined,
        affectedContacts: parameters.type === 'contacts' ? parameters.count || 0 : undefined,
        estimatedTime: 'Instant',
        riskLevel: 'low',
        reversible: true,
        requiresConfirmation: false,
        details: [
          `Export type: ${parameters.type || 'accounts'}`,
          `Columns: ${parameters.columns?.join(', ') || 'All'}`,
        ],
      };
      
    case 'create_campaign':
      return {
        ...basePreview,
        action,
        parameters,
        summary: `Create campaign "${parameters.name || 'New Campaign'}"`,
        affectedAccounts: parameters.account_ids?.length || 0,
        affectedContacts: parameters.contact_ids?.length || 0,
        riskLevel: 'low',
        reversible: true,
        requiresConfirmation: true,
        details: [
          `Campaign type: ${parameters.campaign_type || 'outbound'}`,
          `Name: ${parameters.name || 'New Campaign'}`,
        ],
      };
      
    case 'trigger_scoring':
      return {
        ...basePreview,
        action,
        parameters,
        summary: `Re-score accounts against ${parameters.icp_name || 'active ICP'}`,
        affectedAccounts: parameters.account_count || 0,
        estimatedTime: `${Math.ceil((parameters.account_count || 0) / 50)} minutes`,
        riskLevel: 'medium',
        reversible: false,
        requiresConfirmation: true,
        warnings: parameters.account_count > 1000 
          ? ['Scoring large datasets may take several minutes']
          : undefined,
        details: [
          `ICP: ${parameters.icp_name || 'Active ICP'}`,
          `Accounts to score: ${parameters.account_count || 'All matching'}`,
        ],
      };
      
    case 'update_icp':
      return {
        ...basePreview,
        action,
        parameters,
        summary: `Update ICP criteria for "${parameters.icp_name || 'selected ICP'}"`,
        riskLevel: 'high',
        reversible: false,
        requiresConfirmation: true,
        warnings: [
          'This will change your ICP definition',
          'Existing scores may need to be recalculated',
        ],
        details: Object.entries(parameters.criteria_updates || {}).map(
          ([key, value]) => `${key}: ${JSON.stringify(value)}`
        ),
      };
      
    case 'sync_to_crm':
      return {
        ...basePreview,
        action,
        parameters,
        summary: `Sync ${parameters.ids?.length || 0} records to ${parameters.crm_type || 'CRM'}`,
        affectedAccounts: parameters.type === 'accounts' ? parameters.ids?.length || 0 : undefined,
        affectedContacts: parameters.type === 'contacts' ? parameters.ids?.length || 0 : undefined,
        estimatedTime: `${Math.ceil((parameters.ids?.length || 0) / 20)} minutes`,
        riskLevel: 'medium',
        reversible: false,
        requiresConfirmation: true,
        warnings: parameters.ids?.length > 100 
          ? ['Large syncs may be rate-limited by your CRM']
          : undefined,
        details: [
          `CRM: ${parameters.crm_type || 'Auto-detect'}`,
          `Record type: ${parameters.type || 'accounts'}`,
        ],
      };
      
    case 'schedule_enrichment':
      return {
        ...basePreview,
        action,
        parameters,
        summary: `Schedule recurring enrichment (${parameters.frequency || 'daily'})`,
        riskLevel: 'low',
        reversible: true,
        requiresConfirmation: true,
        details: [
          `Frequency: ${parameters.frequency || 'daily'}`,
          `Enrichment types: ${parameters.enrichment_types?.join(', ') || 'firmographics'}`,
          `Filters: ${JSON.stringify(parameters.filters) || 'All accounts'}`,
        ],
      };
      
    default:
      return {
        action,
        parameters,
        summary: `Execute ${action}`,
        riskLevel: 'medium',
        reversible: false,
        requiresConfirmation: true,
      };
  }
}

export type { ActionPreviewProps };
