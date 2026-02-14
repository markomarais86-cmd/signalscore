import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, CheckCircle, XCircle, AlertCircle, HelpCircle } from 'lucide-react';

interface ScoreField {
  score: number;
  weight: number;
  weighted: number;
  mandatory?: boolean;
  bonus?: boolean;
  matched: boolean;
}

interface ScoreBreakdownData {
  industry?: ScoreField;
  size?: ScoreField;
  revenue?: ScoreField;
  geography?: ScoreField;
  tech_stack?: ScoreField;
  persona?: ScoreField;
  funding?: ScoreField;
  total_weighted?: number;
  overall?: number;
  [key: string]: ScoreField | number | undefined;
}

interface AccountScoreBreakdownProps {
  reasons: ScoreBreakdownData | Record<string, any>;
  overallScore: number;
  fitScore: number;
}

const FIELD_LABELS: Record<string, string> = {
  industry: 'Industry',
  size: 'Company Size',
  revenue: 'Revenue Range',
  geography: 'Geography',
  tech_stack: 'Tech Stack',
  persona: 'Personas',
  funding: 'Funding',
};

export function AccountScoreBreakdown({ reasons, overallScore, fitScore }: AccountScoreBreakdownProps) {
  // Support both old format (boolean reasons) and new weighted format
  const isWeightedFormat = reasons && typeof reasons === 'object' && 
    Object.values(reasons).some(v => typeof v === 'object' && v !== null && 'weight' in v);

  const fields = isWeightedFormat 
    ? Object.entries(reasons).filter(([k, v]) => typeof v === 'object' && v !== null && 'weight' in v) as [string, ScoreField][]
    : [];

  // Legacy format support
  const legacyFields = !isWeightedFormat && reasons
    ? Object.entries(reasons).filter(([k]) => k.endsWith('_match')).map(([k, v]) => ({
        key: k.replace('_match', ''),
        matched: v as boolean,
      }))
    : [];

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-between p-2 rounded hover:bg-muted/50">
        <span className="flex items-center gap-1">
          <HelpCircle className="h-3 w-3" />
          Score Breakdown
        </span>
        <ChevronDown className="h-3 w-3" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-3 space-y-2 bg-muted/20 rounded-lg mt-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Overall</span>
            <span className={`font-bold ${getScoreColor(overallScore)}`}>{overallScore}/100</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">Fit</span>
            <span className={`font-bold ${getScoreColor(fitScore)}`}>{fitScore}/100</span>
          </div>
          
          <div className="border-t border-border pt-2 space-y-1.5">
            {isWeightedFormat ? (
              fields.map(([key, field]) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  {field.matched ? (
                    <CheckCircle className="h-3 w-3 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-400 shrink-0" />
                  )}
                  <span className="flex-1 truncate">{FIELD_LABELS[key] || key}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {field.mandatory && <Badge variant="destructive" className="text-[9px] px-1 py-0 h-3.5">Req</Badge>}
                    {field.bonus && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5">Bonus</Badge>}
                    <span className="text-muted-foreground w-6 text-right">{field.weight}×</span>
                    <span className={`w-8 text-right font-mono ${field.matched ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {Math.round(field.weighted)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              legacyFields.map(({ key, matched }) => (
                <div key={key} className="flex items-center gap-2 text-xs">
                  {matched ? (
                    <CheckCircle className="h-3 w-3 text-green-500" />
                  ) : (
                    <XCircle className="h-3 w-3 text-red-400" />
                  )}
                  <span>{FIELD_LABELS[key] || key}</span>
                  <span className={`ml-auto ${matched ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {matched ? 'Match' : 'No match'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
