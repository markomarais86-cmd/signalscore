import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Clock, TrendingUp } from "lucide-react";

interface ICPCriteria {
  companySize: string;
  industry: string;
  geography: string;
  revenue: string;
}

interface ICPAnalysisData {
  criteria: ICPCriteria;
  confidence: number;
  lastUpdated: string;
}

interface ICPAnalysisProps {
  data: ICPAnalysisData;
}

export function ICPAnalysis({ data }: ICPAnalysisProps) {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-[hsl(var(--signal-high))]";
    if (confidence >= 70) return "text-[hsl(var(--signal-medium))]";
    return "text-[hsl(var(--signal-low))]";
  };

  const getConfidenceBadgeColor = (confidence: number) => {
    if (confidence >= 90) return "bg-[hsl(var(--signal-high))]";
    if (confidence >= 70) return "bg-[hsl(var(--signal-medium))]";
    return "bg-[hsl(var(--signal-low))]";
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Live ICP Definition
          </CardTitle>
          <Badge className={`text-white ${getConfidenceBadgeColor(data.confidence)}`}>
            {data.confidence}% Confidence
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          AI-generated Ideal Customer Profile based on CRM + enrichment data
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Company Size</label>
                <div className="font-medium">{data.criteria.companySize}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Industry</label>
                <div className="font-medium">{data.criteria.industry}</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Geography</label>
                <div className="font-medium">{data.criteria.geography}</div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Revenue Range</label>
                <div className="font-medium">{data.criteria.revenue}</div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Last updated: {formatDate(data.lastUpdated)}</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--signal-high))]" />
              <span className={`text-sm font-medium ${getConfidenceColor(data.confidence)}`}>
                High Accuracy
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}