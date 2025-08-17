import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Building2, Factory } from "lucide-react";

interface SubIndustryData {
  parentIndustry: string;
  subIndustry: string;
  naicsCode: string;
  signalScore: number;
  accountCount: number;
  tamValue: number;
  conversionRate: number;
  trend: number;
}

interface SubIndustryBreakdownProps {
  data: SubIndustryData[];
}

export function SubIndustryBreakdown({ data }: SubIndustryBreakdownProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-[hsl(var(--signal-high))]";
    if (score >= 60) return "text-[hsl(var(--signal-medium))]";
    return "text-[hsl(var(--signal-low))]";
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-[hsl(var(--signal-high))]";
    if (score >= 60) return "bg-[hsl(var(--signal-medium))]";
    return "bg-[hsl(var(--signal-low))]";
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000000) return `$${(value / 1000000000).toFixed(1)}B`;
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const sortedData = [...data].sort((a, b) => b.signalScore - a.signalScore);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-5 w-5" />
          Sub-Industry Performance
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          NAICS/SIC level breakdown ranked by SignalScore efficiency
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sortedData.map((item, index) => (
            <div key={`${item.naicsCode}-${index}`} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">
                        {item.parentIndustry} → {item.subIndustry}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        NAICS: {item.naicsCode}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge className={`text-white ${getScoreBadgeColor(item.signalScore)}`}>
                    Score {item.signalScore}
                  </Badge>
                  {item.trend > 0 && (
                    <div className="flex items-center gap-1 text-[hsl(var(--signal-high))]">
                      <TrendingUp className="h-3 w-3" />
                      <span className="text-xs">+{item.trend}%</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Accounts</div>
                  <div className="font-medium">{item.accountCount.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">TAM Value</div>
                  <div className="font-medium">{formatCurrency(item.tamValue)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Conversion</div>
                  <div className="font-medium">{item.conversionRate}%</div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>Performance vs Industry Average</span>
                  <span className={getScoreColor(item.signalScore)}>
                    {item.signalScore >= 70 ? "Above" : item.signalScore >= 50 ? "Average" : "Below"}
                  </span>
                </div>
                <Progress value={item.signalScore} className="h-2" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}