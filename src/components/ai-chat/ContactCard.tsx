import { User, Mail, Phone, Linkedin, Building2, CheckCircle, Copy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface ContactCardData {
  id?: string | number;
  name: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  persona?: string;
  level?: string;
  email?: string;
  email_verified?: boolean;
  phone?: string;
  mobile?: string;
  linkedin_url?: string;
  country?: string;
  account_external_id?: string;
  accounts?: {
    name?: string;
    industry_norm?: string;
    country?: string;
  };
}

interface ContactCardProps {
  contact: ContactCardData;
  onViewProfile?: (id: string | number) => void;
  compact?: boolean;
}

function getPersonaColor(persona?: string): string {
  if (!persona) return 'bg-muted text-muted-foreground';
  const p = persona.toLowerCase();
  if (p.includes('executive') || p.includes('decision maker')) {
    return 'bg-primary/10 text-primary border-primary/20';
  }
  if (p.includes('technical')) {
    return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  }
  if (p.includes('financial') || p.includes('cfo')) {
    return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
  }
  return 'bg-muted text-muted-foreground';
}

function getLevelBadge(level?: string): string {
  if (!level) return '';
  const l = level.toLowerCase();
  if (l.includes('c-level') || l.includes('chief')) return '👑';
  if (l.includes('vp') || l.includes('vice')) return '⭐';
  if (l.includes('director')) return '🎯';
  if (l.includes('manager')) return '📊';
  return '';
}

export function ContactCard({ contact, onViewProfile, compact = false }: ContactCardProps) {
  const copyEmail = async () => {
    if (contact.email) {
      await navigator.clipboard.writeText(contact.email);
      toast.success('Email copied to clipboard');
    }
  };

  const copyPhone = async () => {
    const phone = contact.phone || contact.mobile;
    if (phone) {
      await navigator.clipboard.writeText(phone);
      toast.success('Phone copied to clipboard');
    }
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-border/50 hover:bg-muted/80 transition-colors">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <p className="font-medium text-sm truncate">{contact.name}</p>
              {contact.email_verified && (
                <CheckCircle className="w-3 h-3 text-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {contact.title || 'No title'} {contact.accounts?.name ? `at ${contact.accounts.name}` : ''}
            </p>
          </div>
        </div>
        {contact.persona && (
          <Badge variant="outline" className={cn('text-xs ml-2 flex-shrink-0', getPersonaColor(contact.persona))}>
            {contact.persona}
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
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <h4 className="font-semibold text-sm truncate">{contact.name}</h4>
              {getLevelBadge(contact.level) && (
                <span className="text-sm">{getLevelBadge(contact.level)}</span>
              )}
              {contact.email_verified && (
                <CheckCircle className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{contact.title || 'No title'}</p>
          </div>
        </div>
        {contact.persona && (
          <Badge variant="outline" className={cn('text-xs flex-shrink-0', getPersonaColor(contact.persona))}>
            {contact.persona}
          </Badge>
        )}
      </div>

      {/* Company */}
      {contact.accounts?.name && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
          <Building2 className="w-3 h-3" />
          <span className="truncate">{contact.accounts.name}</span>
          {contact.accounts.industry_norm && (
            <span className="text-muted-foreground/60">• {contact.accounts.industry_norm}</span>
          )}
        </div>
      )}

      {/* Contact Info */}
      <div className="space-y-1 mb-2">
        {contact.email && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 min-w-0">
              <Mail className="w-3 h-3 text-muted-foreground" />
              <span className="truncate text-muted-foreground">{contact.email}</span>
              {contact.email_verified && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">verified</Badge>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 w-5 p-0"
              onClick={copyEmail}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        )}
        {(contact.phone || contact.mobile) && (
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 min-w-0">
              <Phone className="w-3 h-3 text-muted-foreground" />
              <span className="truncate text-muted-foreground">{contact.phone || contact.mobile}</span>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 w-5 p-0"
              onClick={copyPhone}
            >
              <Copy className="w-3 h-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {contact.linkedin_url && (
          <Button 
            size="sm" 
            variant="outline" 
            className="flex-1 text-xs h-7"
            asChild
          >
            <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer">
              <Linkedin className="w-3 h-3 mr-1" />
              LinkedIn
            </a>
          </Button>
        )}
        {onViewProfile && contact.id && (
          <Button 
            size="sm" 
            variant="ghost" 
            className="flex-1 text-xs h-7"
            onClick={() => onViewProfile(contact.id!)}
          >
            View Profile
          </Button>
        )}
      </div>
    </div>
  );
}

interface ContactCardListProps {
  contacts: ContactCardData[];
  onViewProfile?: (id: string | number) => void;
  maxDisplay?: number;
}

export function ContactCardList({ contacts, onViewProfile, maxDisplay = 5 }: ContactCardListProps) {
  const displayContacts = contacts.slice(0, maxDisplay);
  const remaining = contacts.length - maxDisplay;

  return (
    <div className="space-y-2">
      {displayContacts.map((contact, i) => (
        <ContactCard 
          key={contact.id || i} 
          contact={contact} 
          onViewProfile={onViewProfile}
          compact={contacts.length > 3}
        />
      ))}
      {remaining > 0 && (
        <p className="text-xs text-muted-foreground text-center py-1">
          ...and {remaining} more contact{remaining > 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}
