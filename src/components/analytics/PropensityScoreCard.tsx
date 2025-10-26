import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, AlertCircle } from 'lucide-react';

interface PropensityScoreCardProps {
  accountName: string;
  propensityScore?: number | null;
  computedAt?: string | null;
  reasons?: string[];
}

export function PropensityScoreCard({ 
  accountName, 
  propensityScore, 
  computedAt,
  reasons = []
}: PropensityScoreCardProps) {
  if (!propensityScore) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Propensity Score</CardTitle>
          </div>
          <CardDescription>ML-powered likelihood to close</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Propensity score not yet calculated
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Requires sufficient closed-won data for training
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getScoreLevel = (score: number) => {
    if (score >= 75) return { label: 'Very High', color: 'bg-green-500' };
    if (score >= 50) return { label: 'High', color: 'bg-blue-500' };
    if (score >= 25) return { label: 'Medium', color: 'bg-yellow-500' };
    return { label: 'Low', color: 'bg-red-500' };
  };

  const scoreLevel = getScoreLevel(propensityScore);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Propensity Score</CardTitle>
          </div>
          <Badge variant="outline">{scoreLevel.label}</Badge>
        </div>
        <CardDescription>ML-powered likelihood to close</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-3xl font-bold">{propensityScore}%</span>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <Progress value={propensityScore} className="h-2" />
        </div>

        {computedAt && (
          <p className="text-xs text-muted-foreground">
            Last updated: {new Date(computedAt).toLocaleDateString()}
          </p>
        )}

        {reasons.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-sm font-medium">Why this score?</p>
            <ul className="space-y-1">
              {reasons.map((reason, idx) => (
                <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
