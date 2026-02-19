import { Building2, Users, MapPin, TrendingUp, ExternalLink, Mail, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface AccountCardData {
  external_id: string;
  name: string;
  domain?: string;
  industry_norm?: string;
  country?: string;
  employee_count?: number;
  revenue_range?: string;
  score?: number;
  fit?: number;
  intent?: number;
  tech_stack?: string[];
  last_funding_round?: string;
  matching_contacts?: Array<{
    name: string;
    title: string;
    persona?: string;
    email_verified?: boolean;
  }>;
}

interface AccountCardProps {
  account: AccountCardData;
  onViewAccount?: (id: string) => void;
  onFindContacts?: (id: string) => void;
  compact?: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 60) return 'bg-[hsl(var(--fit-high))] text-[hsl(var(--fit-high-foreground))]';
  if (score >= 40) return 'bg-[hsl(var(--fit-medium))] text-[hsl(var(--fit-medium-foreground))]';
  return 'bg-[hsl(var(--fit-low))] text-[hsl(var(--fit-low-foreground))]';
}

function getScoreLabel(score: number): string {
  if (score >= 60) return 'High Fit';
  if (score >= 40) return 'Medium Fit';
  return 'Low Fit';
}

export function AccountCard({ account, onViewAccount, onFindContacts, compact = false }: AccountCardProps) {
  const score = account.score || 0;
  
  if (compact) {
    return (
      <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-border/50 hover:bg-muted/80 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold', getScoreColor(score))}>
            {score}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{account.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {account.industry_norm || 'Unknown'} • {account.employee_count ? `${account.employee_count} employees` : 'Size unknown'}
            </p>
          </div>
        </div>
        {account.matching_contacts && account.matching_contacts.length > 0 && (
          <Badge variant="secondary" className="text-xs ml-2 flex-shrink-0">
            {account.matching_contacts.length} contact{account.matching_contacts.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 bg-card rounded-lg border border-border shadow-sm hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0', getScoreColor(score))}>
            {score}
          </div>
          <div className="min-w-0">
            <h4 className="font-semibold text-sm truncate">{account.name}</h4>
            {account.domain && (
              <a 
                href={`https://${account.domain}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 truncate"
              >
                <Globe className="w-3 h-3" />
                {account.domain}
              </a>
            )}
          </div>
        </div>
        <Badge variant="outline" className="text-xs flex-shrink-0">
          {getScoreLabel(score)}
        </Badge>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground mb-2">
        {account.industry_norm && (
          <div className="flex items-center gap-1">
            <Building2 className="w-3 h-3" />
            <span className="truncate">{account.industry_norm}</span>
          </div>
        )}
        {account.employee_count && (
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{account.employee_count.toLocaleString()} employees</span>
          </div>
        )}
        {account.country && (
          <div className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{account.country}</span>
          </div>
        )}
        {account.last_funding_round && (
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span className="truncate">{account.last_funding_round}</span>
          </div>
        )}
      </div>

      {/* Tech Stack */}
      {account.tech_stack && account.tech_stack.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {account.tech_stack.slice(0, 3).map((tech, i) => (
            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">
              {tech}
            </Badge>
          ))}
          {account.tech_stack.length > 3 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              +{account.tech_stack.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Matching Contacts */}
      {account.matching_contacts && account.matching_contacts.length > 0 && (
        <div className="mb-2 p-2 bg-muted/50 rounded-md">
          <p className="text-xs font-medium mb-1 flex items-center gap-1">
            <Mail className="w-3 h-3" />
            {account.matching_contacts.length} matching contact{account.matching_contacts.length > 1 ? 's' : ''}
          </p>
          <div className="space-y-1">
            {account.matching_contacts.slice(0, 2).map((contact, i) => (
              <p key={i} className="text-xs text-muted-foreground truncate">
                • {contact.name} - {contact.title}
                {contact.email_verified && <span className="text-primary ml-1">✓</span>}
              </p>
            ))}
            {account.matching_contacts.length > 2 && (
              <p className="text-xs text-muted-foreground">
                ...and {account.matching_contacts.length - 2} more
              </p>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {onViewAccount && (
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-xs h-7"
            onClick={() => onViewAccount(account.external_id)}
          >
            <ExternalLink className="w-3 h-3 mr-1" />
            View
          </Button>
        )}
        {onFindContacts && (
          <Button 
            size="sm" 
            variant="ghost" 
            className="flex-1 text-xs h-7"
            onClick={() => onFindContacts(account.external_id)}
          >
            <Users className="w-3 h-3 mr-1" />
            Contacts
          </Button>
        )}
      </div>
    </div>
  );
}

interface AccountCardListProps {
  accounts: AccountCardData[];
  onViewAccount?: (id: string) => void;
  onFindContacts?: (id: string) => void;
  maxDisplay?: number;
}

export function AccountCardList({ accounts, onViewAccount, onFindContacts, maxDisplay = 5 }: AccountCardListProps) {
  const displayAccounts = accounts.slice(0, maxDisplay);
  const remaining = accounts.length - maxDisplay;

  return (
    <div className="space-y-2">
      {displayAccounts.map((account, i) => (
        <AccountCard 
          key={account.external_id || i} 
          account={account} 
          onViewAccount={onViewAccount}
          onFindContacts={onFindContacts}
          compact={accounts.length > 3}
        />
      ))}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground text-center py-1">
          ...and {remaining} more account{remaining > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
