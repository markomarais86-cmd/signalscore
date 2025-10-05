import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { TrendIndicator } from "./TrendIndicator";
import { useNavigate } from "react-router-dom";

interface ScoringDataQualityCardProps {
  scoringProgress: number;
  totalScored: number;
  totalAccounts: number;
  crmScored: number;
  crmTotal: number;
  databaseScored: number;
  databaseTotal: number;
  completeness: number;
  industryCompleteness: number;
  sizeCompleteness: number;
  revenueCompleteness: number;
  geoCompleteness: number;
  contactsCompleteness: number;
  scoringTrend?: number;
  completenessTrend?: number;
}

export function ScoringDataQualityCard({
  scoringProgress,
  totalScored,
  totalAccounts,
  crmScored,
  crmTotal,
  databaseScored,
  databaseTotal,
  completeness,
  industryCompleteness,
  sizeCompleteness,
  revenueCompleteness,
  geoCompleteness,
  contactsCompleteness,
  scoringTrend = 0,
  completenessTrend = 0
}: ScoringDataQualityCardProps) {
  const navigate = useNavigate();
  const unscoredAccounts = totalAccounts - totalScored;

  const getCompletenessColor = (value: number) => {
    if (value >= 80) return "text-executive-green";
    if (value >= 60) return "text-executive-amber";
    return "text-executive-red";
  };

  const getCompletenessIcon = (value: number) => {
    if (value >= 80) return <CheckCircle2 className="h-4 w-4 text-executive-green" />;
    return <AlertCircle className="h-4 w-4 text-executive-amber" />;
  };

  return (
    <Card className="col-span-full">
      <CardHeader>
        <CardTitle className="text-2xl flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Scoring & Data Quality Overview
        </CardTitle>
        <CardDescription>
          Account scoring progress and field-level data completeness
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Scoring Progress */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-4xl font-bold text-signal-medium">{scoringProgress}%</div>
                <p className="text-sm text-muted-foreground mt-1">
                  {totalScored.toLocaleString()} of {totalAccounts.toLocaleString()} accounts scored
                </p>
              </div>
              {scoringTrend !== 0 && (
                <TrendIndicator value={scoringTrend} />
              )}
            </div>

            <Progress value={scoringProgress} className="h-2" />

            {/* CRM Breakdown */}
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">🏢 CRM Accounts</span>
                <span className="text-xs text-muted-foreground">
                  {crmScored.toLocaleString()} / {crmTotal.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={crmTotal > 0 ? (crmScored / crmTotal) * 100 : 0} 
                className="h-1.5" 
              />
            </div>

            {/* Database Breakdown */}
            <div className="space-y-2 pl-4 border-l-2 border-muted">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">💾 Database Accounts</span>
                <span className="text-xs text-muted-foreground">
                  {databaseScored.toLocaleString()} / {databaseTotal.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={databaseTotal > 0 ? (databaseScored / databaseTotal) * 100 : 0} 
                className="h-1.5" 
              />
            </div>

            {unscoredAccounts > 0 && (
              <Button 
                className="w-full mt-4" 
                onClick={() => navigate('/accounts')}
              >
                Score Remaining {unscoredAccounts.toLocaleString()} Accounts →
              </Button>
            )}
          </div>

          {/* Right: Data Completeness */}
          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <div>
                <div className={`text-4xl font-bold ${getCompletenessColor(completeness)}`}>
                  {completeness}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Overall data completeness
                </p>
              </div>
              {completenessTrend !== 0 && (
                <TrendIndicator value={completenessTrend} />
              )}
            </div>

            <div className="space-y-3 mt-4">
              {/* Industry */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  {getCompletenessIcon(industryCompleteness)}
                  <span className="text-sm">Industry</span>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <Progress value={industryCompleteness} className="h-1.5 flex-1" />
                  <span className={`text-sm font-medium w-12 text-right ${getCompletenessColor(industryCompleteness)}`}>
                    {industryCompleteness}%
                  </span>
                </div>
              </div>

              {/* Size */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  {getCompletenessIcon(sizeCompleteness)}
                  <span className="text-sm">Size</span>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <Progress value={sizeCompleteness} className="h-1.5 flex-1" />
                  <span className={`text-sm font-medium w-12 text-right ${getCompletenessColor(sizeCompleteness)}`}>
                    {sizeCompleteness}%
                  </span>
                </div>
              </div>

              {/* Revenue */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  {getCompletenessIcon(revenueCompleteness)}
                  <span className="text-sm">Revenue</span>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <Progress value={revenueCompleteness} className="h-1.5 flex-1" />
                  <span className={`text-sm font-medium w-12 text-right ${getCompletenessColor(revenueCompleteness)}`}>
                    {revenueCompleteness}%
                  </span>
                </div>
              </div>

              {/* Geography */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  {getCompletenessIcon(geoCompleteness)}
                  <span className="text-sm">Geography</span>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <Progress value={geoCompleteness} className="h-1.5 flex-1" />
                  <span className={`text-sm font-medium w-12 text-right ${getCompletenessColor(geoCompleteness)}`}>
                    {geoCompleteness}%
                  </span>
                </div>
              </div>

              {/* Contacts */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  {getCompletenessIcon(contactsCompleteness)}
                  <span className="text-sm">Contacts</span>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <Progress value={contactsCompleteness} className="h-1.5 flex-1" />
                  <span className={`text-sm font-medium w-12 text-right ${getCompletenessColor(contactsCompleteness)}`}>
                    {contactsCompleteness}%
                  </span>
                </div>
              </div>
            </div>

            {completeness < 70 && (
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => navigate('/settings?tab=integrations&action=enrich')}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Enrich Missing Data →
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
