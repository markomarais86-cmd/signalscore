import { useState } from 'react';
import { 
  Building2, Users, MapPin, TrendingUp, Globe, Mail, 
  ChevronDown, ChevronUp, ExternalLink, Sparkles, CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { AccountCardData } from './AccountCard';

interface RecommendedAccountCardProps {
  account: AccountCardData & {
    priority_reasoning?: string;
    recommendation_rank?: number;
  };
  isSelected?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  onViewAccount?: (id: string) => void;
  onFindContacts?: (id: string) => void;
  onCreateCampaign?: (id: string) => void;
  initialExpanded?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-[hsl(var(--fit-high))] text-[hsl(var(--fit-high-foreground))]';
  if (score >= 40) return 'bg-[hsl(var(--fit-medium))] text-[hsl(var(--fit-medium-foreground))]';
  return 'bg-[hsl(var(--fit-low))] text-[hsl(var(--fit-low-foreground))]';
}

function getPriorityBadge(rank?: number) {
  if (!rank) return null;
  if (rank <= 3) return { label: 'Top Pick', variant: 'default' as const, className: 'bg-primary' };
  if (rank <= 5) return { label: 'High Priority', variant: 'secondary' as const, className: '' };
  return { label: `#${rank}`, variant: 'outline' as const, className: '' };
}

export function RecommendedAccountCard({
  account,
  isSelected = false,
  onSelect,
  onViewAccount,
  onFindContacts,
  onCreateCampaign,
  initialExpanded = false,
}: RecommendedAccountCardProps) {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const score = account.score || 0;
  const priorityBadge = getPriorityBadge(account.recommendation_rank);

  return (
    <div className={cn(
      "rounded-lg border transition-all",
      isSelected ? "border-primary bg-primary/5" : "border-border bg-card",
      "hover:shadow-md"
    )}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        {/* Header - Always visible */}
        <div className="p-3">
          <div className="flex items-start gap-3">
            {/* Checkbox for selection */}
            {onSelect && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => onSelect(account.external_id, checked as boolean)}
                className="mt-1"
              />
            )}

            {/* Score badge */}
            <div className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0',
              getScoreColor(score)
            )}>
              {score}
            </div>

            {/* Main info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-semibold text-sm">{account.name}</h4>
                {priorityBadge && (
                  <Badge variant={priorityBadge.variant} className={cn("text-[10px]", priorityBadge.className)}>
                    {priorityBadge.label}
                  </Badge>
                )}
              </div>

              {/* Quick stats row */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                {account.industry_norm && (
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {account.industry_norm}
                  </span>
                )}
                {account.employee_count && (
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {account.employee_count.toLocaleString()}
                  </span>
                )}
                {account.country && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {account.country}
                  </span>
                )}
                {account.matching_contacts && account.matching_contacts.length > 0 && (
                  <span className="flex items-center gap-1 text-primary">
                    <Mail className="w-3 h-3" />
                    {account.matching_contacts.length} contact{account.matching_contacts.length > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Priority reasoning - always show summary */}
              {account.priority_reasoning && (
                <div className="mt-2 flex items-start gap-1.5">
                  <Sparkles className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground line-clamp-2">{account.priority_reasoning}</p>
                </div>
              )}
            </div>

            {/* Expand trigger */}
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 pt-0 border-t border-border/50">
            <div className="pt-3 space-y-3">
              {/* Domain and funding */}
              <div className="flex items-center gap-4 text-xs">
                {account.domain && (
                  <a 
                    href={`https://${account.domain}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-primary flex items-center gap-1"
                  >
                    <Globe className="w-3 h-3" />
                    {account.domain}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {account.last_funding_round && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <TrendingUp className="w-3 h-3" />
                    {account.last_funding_round}
                  </span>
                )}
                {account.revenue_range && (
                  <span className="text-muted-foreground">{account.revenue_range}</span>
                )}
              </div>

              {/* Tech Stack */}
              {account.tech_stack && account.tech_stack.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Tech Stack</p>
                  <div className="flex flex-wrap gap-1">
                    {account.tech_stack.map((tech, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching Contacts */}
              {account.matching_contacts && account.matching_contacts.length > 0 && (
                <div className="p-2 bg-muted/50 rounded-md">
                  <p className="text-xs font-medium mb-2 flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    Matching Contacts
                  </p>
                  <div className="space-y-1">
                    {account.matching_contacts.map((contact, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {contact.name} - {contact.title}
                        </span>
                        {contact.email_verified && (
                          <CheckCircle2 className="w-3 h-3 text-primary" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                {onViewAccount && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-xs h-7"
                    onClick={() => onViewAccount(account.external_id)}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View Details
                  </Button>
                )}
                {onFindContacts && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1 text-xs h-7"
                    onClick={() => onFindContacts(account.external_id)}
                  >
                    <Users className="w-3 h-3 mr-1" />
                    Find Contacts
                  </Button>
                )}
                {onCreateCampaign && (
                  <Button 
                    size="sm" 
                    variant="default" 
                    className="flex-1 text-xs h-7"
                    onClick={() => onCreateCampaign(account.external_id)}
                  >
                    <Mail className="w-3 h-3 mr-1" />
                    Campaign
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

interface RecommendedAccountsListProps {
  accounts: Array<AccountCardData & { priority_reasoning?: string; recommendation_rank?: number }>;
  onViewAccount?: (id: string) => void;
  onFindContacts?: (id: string) => void;
  onCreateCampaign?: (ids: string[]) => void;
  maxDisplay?: number;
}

export function RecommendedAccountsList({
  accounts,
  onViewAccount,
  onFindContacts,
  onCreateCampaign,
  maxDisplay = 5,
}: RecommendedAccountsListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const displayAccounts = showAll ? accounts : accounts.slice(0, maxDisplay);
  const remaining = accounts.length - maxDisplay;

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === accounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(accounts.map(a => a.external_id)));
    }
  };

  return (
    <div className="space-y-2">
      {/* Bulk actions header */}
      {onCreateCampaign && accounts.length > 1 && (
        <div className="flex items-center justify-between p-2 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <Checkbox 
              checked={selectedIds.size === accounts.length}
              onCheckedChange={handleSelectAll}
            />
            <span className="text-xs text-muted-foreground">
              {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <Button 
              size="sm" 
              className="h-7 text-xs"
              onClick={() => onCreateCampaign(Array.from(selectedIds))}
            >
              <Mail className="w-3 h-3 mr-1" />
              Create Campaign ({selectedIds.size})
            </Button>
          )}
        </div>
      )}

      {/* Account cards */}
      {displayAccounts.map((account, i) => (
        <RecommendedAccountCard
          key={account.external_id || i}
          account={{ ...account, recommendation_rank: account.recommendation_rank || i + 1 }}
          isSelected={selectedIds.has(account.external_id)}
          onSelect={onCreateCampaign ? handleSelect : undefined}
          onViewAccount={onViewAccount}
          onFindContacts={onFindContacts}
          onCreateCampaign={onCreateCampaign ? (id) => onCreateCampaign([id]) : undefined}
          initialExpanded={i === 0}
        />
      ))}

      {/* Show more/less */}
      {remaining > 0 && !showAll && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setShowAll(true)}
        >
          <ChevronDown className="w-3 h-3 mr-1" />
          Show {remaining} more account{remaining > 1 ? 's' : ''}
        </Button>
      )}
      {showAll && remaining > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setShowAll(false)}
        >
          <ChevronUp className="w-3 h-3 mr-1" />
          Show less
        </Button>
      )}
    </div>
  );
}
