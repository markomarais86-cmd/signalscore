import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";

interface FieldScore {
  [key: string]: number; // 0, 1, or 2
}

interface FieldScoreDisplayProps {
  fieldScores: FieldScore | null;
  overallScore: number | null;
  compact?: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  first_name: 'First Name',
  last_name: 'Last Name',
  email: 'Email',
  phone: 'Phone',
  direct_phone: 'Direct Phone',
  cell_phone: 'Cell Phone',
  title: 'Job Title',
  current_title: 'Current Title',
  linkedin_url: 'LinkedIn URL',
  company: 'Company',
  city: 'City',
  state_province: 'State',
  country: 'Country',
  employee_count: 'Employee Count',
  revenue_range: 'Revenue Range',
  industry: 'Industry',
  founded_year: 'Founded Year',
  funding_stage: 'Funding Stage',
  total_raised: 'Total Raised',
  domain: 'Domain',
  verified_email: 'Verified Email',
  still_at_company: 'Still at Company'
};

const SCORE_COLORS = {
  0: 'text-[hsl(var(--signal-low))]',
  1: 'text-[hsl(var(--signal-medium))]',
  2: 'text-[hsl(var(--signal-high))]'
};

const SCORE_LABELS = {
  0: 'Missing',
  1: 'Partial',
  2: 'Complete'
};

export function FieldScoreDisplay({ fieldScores, overallScore, compact = false }: FieldScoreDisplayProps) {
  if (!fieldScores || Object.keys(fieldScores).length === 0) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Not Scored
      </Badge>
    );
  }

  const scores = Object.entries(fieldScores);
  const maxPossibleScore = scores.length * 2;
  const actualScore = scores.reduce((acc, [_, score]) => acc + (score as number), 0);
  const percentage = maxPossibleScore > 0 ? Math.round((actualScore / maxPossibleScore) * 100) : 0;

  const completeFields = scores.filter(([_, s]) => s === 2).length;
  const partialFields = scores.filter(([_, s]) => s === 1).length;
  const missingFields = scores.filter(([_, s]) => s === 0).length;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2 cursor-help">
              <span className={`font-medium ${
                percentage >= 75 ? 'text-[hsl(var(--signal-high))]' :
                percentage >= 50 ? 'text-[hsl(var(--signal-medium))]' :
                'text-[hsl(var(--signal-low))]'
              }`}>
                {overallScore !== null ? `${overallScore}/20` : `${percentage}%`}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" className="w-80">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">Field Scores</span>
                <span>{actualScore}/{maxPossibleScore} points</span>
              </div>
              <Progress value={percentage} className="h-2" />
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-[hsl(var(--signal-high))]" />
                  <span>{completeFields} complete</span>
                </div>
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-[hsl(var(--signal-medium))]" />
                  <span>{partialFields} partial</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="h-3 w-3 text-[hsl(var(--signal-low))]" />
                  <span>{missingFields} missing</span>
                </div>
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">Data Quality Score</span>
        <Badge variant={percentage >= 75 ? "default" : percentage >= 50 ? "secondary" : "outline"}>
          {percentage}%
        </Badge>
      </div>
      
      <Progress value={percentage} className="h-2" />
      
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--signal-high))]/10">
          <CheckCircle className="h-4 w-4 text-[hsl(var(--signal-high))]" />
          <div>
            <p className="font-medium">{completeFields}</p>
            <p className="text-xs text-muted-foreground">Complete</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--signal-medium))]/10">
          <AlertCircle className="h-4 w-4 text-[hsl(var(--signal-medium))]" />
          <div>
            <p className="font-medium">{partialFields}</p>
            <p className="text-xs text-muted-foreground">Partial</p>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 rounded-lg bg-[hsl(var(--signal-low))]/10">
          <XCircle className="h-4 w-4 text-[hsl(var(--signal-low))]" />
          <div>
            <p className="font-medium">{missingFields}</p>
            <p className="text-xs text-muted-foreground">Missing</p>
          </div>
        </div>
      </div>

      {/* Field-by-field breakdown */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {scores.map(([field, score]) => (
          <div key={field} className="flex items-center justify-between py-1 px-2 rounded hover:bg-muted/50">
            <span className="text-sm">{FIELD_LABELS[field] || field}</span>
            <Badge 
              variant="outline" 
              className={`text-xs ${SCORE_COLORS[score as keyof typeof SCORE_COLORS]}`}
            >
              {SCORE_LABELS[score as keyof typeof SCORE_LABELS]}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}

interface ICPStatusBadgeProps {
  qualified: boolean | null;
  failReasons?: string[] | null;
  size?: 'sm' | 'md' | 'lg';
}

export function ICPStatusBadge({ qualified, failReasons, size = 'md' }: ICPStatusBadgeProps) {
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';
  
  if (qualified === null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        <Info className={`${iconSize} mr-1`} />
        Not Scored
      </Badge>
    );
  }

  if (qualified) {
    return (
      <Badge className="bg-[hsl(var(--signal-high))]">
        <CheckCircle className={`${iconSize} mr-1`} />
        ICP Qualified
      </Badge>
    );
  }

  if (failReasons && failReasons.length > 0) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="destructive" className="cursor-help">
              <XCircle className={`${iconSize} mr-1`} />
              ICP Failed
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="font-medium mb-1">Fail Reasons:</p>
            <ul className="text-xs space-y-1">
              {failReasons.map((reason, i) => (
                <li key={i}>• {reason}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant="destructive">
      <XCircle className={`${iconSize} mr-1`} />
      ICP Failed
    </Badge>
  );
}