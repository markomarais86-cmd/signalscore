import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Database, LucideIcon } from "lucide-react";

interface DataSourceBreakdownCardProps {
  title: "Accounts" | "Leads";
  icon: LucideIcon;
  total: number;
  crm: {
    count: number;
    highFit: number;
    highFitPercentage: number;
  };
  database: {
    count: number;
    highFit: number;
    highFitPercentage: number;
  };
}

export function DataSourceBreakdownCard({
  title,
  icon: Icon,
  total,
  crm,
  database,
}: DataSourceBreakdownCardProps) {
  const getPercentageBarColor = (percentage: number) => {
    if (percentage >= 70) return "bg-success";
    if (percentage >= 50) return "bg-warning";
    return "bg-destructive";
  };

  const getPercentageBadgeVariant = (percentage: number): "default" | "secondary" | "destructive" | "outline" => {
    if (percentage >= 70) return "default";
    if (percentage >= 50) return "secondary";
    return "destructive";
  };

  return (
    <Card className="bg-gradient-to-br from-card to-card/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Icon className="h-5 w-5 text-primary" />
          {title}
        </CardTitle>
        <p className="text-3xl font-bold text-foreground">{total.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">Total {title.toLowerCase()}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* CRM Breakdown */}
        <Card className="border-l-4 border-l-primary bg-card/80 backdrop-blur-sm hover:bg-card hover:shadow-md transition-all">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">CRM</span>
              </div>
              <span className="text-2xl font-bold">{crm.count.toLocaleString()}</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">High-Fit Matches</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{crm.highFit.toLocaleString()}</span>
                  <Badge variant={getPercentageBadgeVariant(crm.highFitPercentage)} className="text-xs">
                    {crm.highFitPercentage}%
                  </Badge>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getPercentageBarColor(crm.highFitPercentage)}`}
                  style={{ width: `${crm.highFitPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Breakdown */}
        <Card className="border-l-4 border-l-success bg-card/80 backdrop-blur-sm hover:bg-card hover:shadow-md transition-all">
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-success" />
                <span className="font-semibold text-sm">Database</span>
              </div>
              <span className="text-2xl font-bold">{database.count.toLocaleString()}</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">High-Fit Matches</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{database.highFit.toLocaleString()}</span>
                  <Badge variant={getPercentageBadgeVariant(database.highFitPercentage)} className="text-xs">
                    {database.highFitPercentage}%
                  </Badge>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all ${getPercentageBarColor(database.highFitPercentage)}`}
                  style={{ width: `${database.highFitPercentage}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}
