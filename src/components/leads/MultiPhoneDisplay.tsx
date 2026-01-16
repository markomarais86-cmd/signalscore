import { Phone, Check, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface PhoneData {
  number: string;
  type: 'direct' | 'mobile' | 'office' | 'main';
  sources: string[];
  confidence: number;
  is_valid?: boolean;
  verified_at?: string;
}

interface MultiPhoneDisplayProps {
  phones: PhoneData[];
  compact?: boolean;
}

const sourceColors: Record<string, string> = {
  gemini: 'bg-blue-500/20 text-blue-700 border-blue-300',
  perplexity: 'bg-purple-500/20 text-purple-700 border-purple-300',
  apollo: 'bg-orange-500/20 text-orange-700 border-orange-300',
  pdl: 'bg-green-500/20 text-green-700 border-green-300',
  internal: 'bg-gray-500/20 text-gray-700 border-gray-300',
  zoominfo: 'bg-cyan-500/20 text-cyan-700 border-cyan-300',
  lusha: 'bg-pink-500/20 text-pink-700 border-pink-300',
  hunter: 'bg-amber-500/20 text-amber-700 border-amber-300',
};

const typeLabels: Record<string, string> = {
  direct: 'Direct',
  mobile: 'Mobile',
  office: 'Office',
  main: 'Main',
};

export function MultiPhoneDisplay({ phones, compact = false }: MultiPhoneDisplayProps) {
  if (!phones || phones.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No phone numbers available
      </div>
    );
  }

  if (compact) {
    // Just show the primary phone with source badges
    const primary = phones[0];
    return (
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <a href={`tel:${primary.number}`} className="text-sm hover:underline">
          {formatPhoneNumber(primary.number)}
        </a>
        {primary.sources.length > 0 && (
          <div className="flex gap-1">
            {primary.sources.slice(0, 2).map((source) => (
              <Badge 
                key={source} 
                variant="outline" 
                className={`text-[10px] px-1 py-0 ${sourceColors[source.toLowerCase()] || 'bg-muted'}`}
              >
                {source.toUpperCase()}
              </Badge>
            ))}
            {primary.sources.length > 2 && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                +{primary.sources.length - 2}
              </Badge>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-2">
        {phones.map((phone, index) => (
          <div 
            key={phone.number} 
            className={`flex items-center justify-between p-2 rounded-lg border ${
              index === 0 ? 'bg-primary/5 border-primary/20' : 'bg-muted/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <a 
                    href={`tel:${phone.number}`} 
                    className="font-medium text-sm hover:underline"
                  >
                    {formatPhoneNumber(phone.number)}
                  </a>
                  <Badge variant="secondary" className="text-[10px] py-0">
                    {typeLabels[phone.type] || phone.type}
                  </Badge>
                  {phone.is_valid !== false ? (
                    <Tooltip>
                      <TooltipTrigger>
                        <Check className="h-3 w-3 text-[hsl(var(--signal-high))]" />
                      </TooltipTrigger>
                      <TooltipContent>Valid E.164 format</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertCircle className="h-3 w-3 text-[hsl(var(--signal-low))]" />
                      </TooltipTrigger>
                      <TooltipContent>Format may be invalid</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="flex gap-1 mt-1">
                  {phone.sources.map((source) => (
                    <Badge 
                      key={source} 
                      variant="outline" 
                      className={`text-[10px] px-1.5 py-0 ${sourceColors[source.toLowerCase()] || 'bg-muted'}`}
                    >
                      {source.toUpperCase()}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="text-right">
              <Tooltip>
                <TooltipTrigger>
                  <div className={`text-sm font-semibold ${
                    phone.confidence >= 80 ? 'text-[hsl(var(--signal-high))]' :
                    phone.confidence >= 50 ? 'text-[hsl(var(--signal-medium))]' :
                    'text-[hsl(var(--signal-low))]'
                  }`}>
                    {phone.confidence}%
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  Confidence score
                  {phone.sources.length > 1 && (
                    <div className="text-xs mt-1">
                      +{(phone.sources.length - 1) * 10}% boost from {phone.sources.length} sources
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
              <div className="text-[10px] text-muted-foreground">
                {phone.sources.length > 1 ? `${phone.sources.length} sources` : '1 source'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </TooltipProvider>
  );
}

// Format phone number for display
function formatPhoneNumber(phone: string): string {
  // Remove non-digits except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // US/Canada format: +1 (XXX) XXX-XXXX
  if (cleaned.startsWith('+1') && cleaned.length === 12) {
    return `+1 (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
  }
  
  // Generic international format
  if (cleaned.startsWith('+') && cleaned.length > 10) {
    const countryCode = cleaned.slice(0, cleaned.length - 10);
    const rest = cleaned.slice(-10);
    return `${countryCode} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`;
  }
  
  return phone;
}
