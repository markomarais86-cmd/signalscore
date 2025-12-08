import { useState } from 'react';
import { Mail, Users, Building2, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CampaignAccount {
  external_id: string;
  name: string;
  score?: number;
  contact_count?: number;
}

interface CampaignCreationFlowProps {
  accounts: CampaignAccount[];
  onConfirm: (params: { name: string; accountIds: string[]; campaignType: string }) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const CAMPAIGN_TYPES = [
  { id: 'outbound', label: 'Outbound', icon: Mail, description: 'Cold outreach campaign' },
  { id: 'nurture', label: 'Nurture', icon: Users, description: 'Warm leads nurturing' },
  { id: 'event', label: 'Event', icon: Building2, description: 'Event-based outreach' },
];

export function CampaignCreationFlow({
  accounts,
  onConfirm,
  onCancel,
  isLoading = false,
}: CampaignCreationFlowProps) {
  const [selectedAccounts, setSelectedAccounts] = useState<Set<string>>(
    new Set(accounts.map(a => a.external_id))
  );
  const [campaignName, setCampaignName] = useState(
    `Campaign - ${new Date().toLocaleDateString()} (${accounts.length} accounts)`
  );
  const [campaignType, setCampaignType] = useState('outbound');

  const removeAccount = (id: string) => {
    setSelectedAccounts(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleConfirm = () => {
    onConfirm({
      name: campaignName,
      accountIds: Array.from(selectedAccounts),
      campaignType,
    });
  };

  const selectedCount = selectedAccounts.size;
  const totalContacts = accounts
    .filter(a => selectedAccounts.has(a.external_id))
    .reduce((sum, a) => sum + (a.contact_count || 0), 0);

  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Create Campaign</h3>
        </div>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onCancel}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Campaign Name */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Campaign Name</label>
        <Input
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          className="mt-1 h-8 text-sm"
          placeholder="Enter campaign name..."
        />
      </div>

      {/* Campaign Type */}
      <div>
        <label className="text-xs font-medium text-muted-foreground">Campaign Type</label>
        <div className="grid grid-cols-3 gap-2 mt-1">
          {CAMPAIGN_TYPES.map((type) => (
            <button
              key={type.id}
              onClick={() => setCampaignType(type.id)}
              className={cn(
                "flex flex-col items-center p-2 rounded-md border text-xs transition-colors",
                campaignType === type.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-muted-foreground/50"
              )}
            >
              <type.icon className="w-4 h-4 mb-1" />
              <span className="font-medium">{type.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Accounts */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-muted-foreground">
            Selected Accounts ({selectedCount})
          </label>
          {totalContacts > 0 && (
            <span className="text-xs text-muted-foreground">
              ~{totalContacts} contacts
            </span>
          )}
        </div>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {accounts.map((account) => (
            <div
              key={account.external_id}
              className={cn(
                "flex items-center justify-between p-2 rounded-md text-xs",
                selectedAccounts.has(account.external_id)
                  ? "bg-muted"
                  : "bg-muted/30 opacity-50"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                {account.score && (
                  <Badge variant="outline" className="text-[10px] px-1">
                    {account.score}
                  </Badge>
                )}
                <span className="truncate">{account.name}</span>
              </div>
              {selectedAccounts.has(account.external_id) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => removeAccount(account.external_id)}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleConfirm}
          disabled={isLoading || selectedCount === 0 || !campaignName.trim()}
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin mr-1" />
          ) : (
            <Check className="w-3 h-3 mr-1" />
          )}
          Create Campaign
        </Button>
      </div>
    </div>
  );
}
