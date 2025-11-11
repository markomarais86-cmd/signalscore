import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, TrendingUp, Database } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface ICPCoverageCardProps {
  // Accounts data
  totalAccounts: number;
  crmAccounts: number;
  databaseAccounts: number;
  highFitAccounts: number;
  highFitCrmAccounts: number;
  highFitDatabaseAccounts: number;
  
  // Leads data
  totalLeads: number;
  crmLeads: number;
  databaseLeads: number;
  highFitLeads: number;
  highFitCrmLeads: number;
  highFitDatabaseLeads: number;

  // TAM data (optional)
  tamAccounts?: number;
  tamLeads?: number;
  tamProvider?: string;
}

export function ICPCoverageCard({
  totalAccounts,
  crmAccounts,
  databaseAccounts,
  highFitAccounts,
  highFitCrmAccounts,
  highFitDatabaseAccounts,
  totalLeads,
  crmLeads,
  databaseLeads,
  highFitLeads,
  highFitCrmLeads,
  highFitDatabaseLeads,
  tamAccounts = 0,
  tamLeads = 0,
  tamProvider = 'External DB',
}: ICPCoverageCardProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("accounts");

  const calculatePercentage = (value: number, total: number) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  const getFitBadgeStyles = (percentage: number) => {
    if (percentage >= 70) return "bg-fit-high text-fit-high-foreground border-fit-high";
    if (percentage >= 50) return "bg-fit-medium text-fit-medium-foreground border-fit-medium";
    return "bg-fit-low text-fit-low-foreground border-fit-low";
  };

  const accountsHighFitPct = calculatePercentage(highFitAccounts, totalAccounts);
  const leadsHighFitPct = calculatePercentage(highFitLeads, totalLeads);

  const accountsTableRows = [
    {
      source: "CRM",
      icon: Building2,
      total: crmAccounts,
      highFit: highFitCrmAccounts,
      route: "/accounts?source=crm",
      isTAM: false
    },
    {
      source: "Database",
      icon: Users,
      total: databaseAccounts,
      highFit: highFitDatabaseAccounts,
      route: "/accounts?source=database",
      isTAM: false,
      hasExternalTAM: tamAccounts > 0,
      tamCount: tamAccounts
    }
  ];

  const leadsTableRows = [
    {
      source: "CRM",
      icon: Building2,
      total: crmLeads,
      highFit: highFitCrmLeads,
      route: "/leads?source=crm",
      isTAM: false
    },
    {
      source: "Database",
      icon: Users,
      total: databaseLeads,
      highFit: highFitDatabaseLeads,
      route: "/leads?source=database",
      isTAM: false,
      hasExternalTAM: tamLeads > 0,
      tamCount: tamLeads
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          ICP Coverage Overview
        </CardTitle>
        <CardDescription>
          Total reach and high-fit distribution across data sources
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Totals on Top */}
        <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-muted/30 rounded-lg">
          <div 
            className="cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-colors"
            onClick={() => navigate('/accounts')}
          >
            <div className="flex items-baseline gap-3 mb-2">
              <div className="text-4xl font-bold text-primary">
                {totalAccounts.toLocaleString()}
              </div>
              <Badge 
                className={cn("text-sm font-semibold px-3 py-1 border", getFitBadgeStyles(accountsHighFitPct))}
              >
                {accountsHighFitPct}% High-Fit
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">Total Accounts</div>
            <div className="text-xs text-muted-foreground mt-1">
              {highFitAccounts.toLocaleString()} high-fit accounts
            </div>
          </div>

          <div 
            className="cursor-pointer hover:bg-muted/50 p-3 rounded-lg transition-colors"
            onClick={() => navigate('/leads')}
          >
            <div className="flex items-baseline gap-3 mb-2">
              <div className="text-4xl font-bold text-primary">
                {totalLeads.toLocaleString()}
              </div>
              <Badge 
                className={cn("text-sm font-semibold px-3 py-1 border", getFitBadgeStyles(leadsHighFitPct))}
              >
                {leadsHighFitPct}% High-Fit
              </Badge>
            </div>
            <div className="text-sm text-muted-foreground">Total Leads</div>
            <div className="text-xs text-muted-foreground mt-1">
              {highFitLeads.toLocaleString()} high-fit leads
            </div>
          </div>
        </div>

        {/* Tabs for detailed breakdown */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="accounts">Accounts Breakdown</TabsTrigger>
            <TabsTrigger value="leads">Leads Breakdown</TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="mt-0">
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-semibold text-sm">Source</th>
                    <th className="text-right p-3 font-semibold text-sm">Total</th>
                    <th className="text-right p-3 font-semibold text-sm">High-Fit</th>
                    <th className="text-center p-3 font-semibold text-sm">% High-Fit</th>
                  </tr>
                </thead>
                <tbody>
                  {accountsTableRows.map((row) => {
                    const Icon = row.icon;
                    const pct = calculatePercentage(row.highFit, row.total);
                    return (
                      <tr
                        key={row.source}
                        className={cn(
                          "border-b transition-colors",
                          !row.isTAM && "cursor-pointer hover:bg-muted/50",
                          row.isTAM && "bg-muted/20"
                        )}
                        onClick={() => !row.isTAM && navigate(row.route)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span>{row.source}</span>
                                {row.source === 'CRM' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Building2 className="h-3 w-3 mr-1" />
                                    Salesforce/HubSpot
                                  </Badge>
                                )}
                                {row.source === 'Database' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Database className="h-3 w-3 mr-1" />
                                    Your Data
                                  </Badge>
                                )}
                              </div>
                              {row.hasExternalTAM && (
                                <span className="text-xs text-muted-foreground">
                                  {row.tamCount?.toLocaleString()} available from external sources
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-right p-3 font-mono text-sm">
                          {row.total.toLocaleString()}
                        </td>
                        <td className="text-right p-3 font-mono text-sm font-semibold">
                          {row.isTAM ? "—" : row.highFit.toLocaleString()}
                        </td>
                        <td className="text-center p-3">
                          {row.isTAM ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              N/A
                            </Badge>
                          ) : (
                            <Badge
                              className={cn("font-semibold border", getFitBadgeStyles(pct))}
                            >
                              {pct}%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="leads" className="mt-0">
            <div className="rounded-lg border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-semibold text-sm">Source</th>
                    <th className="text-right p-3 font-semibold text-sm">Total</th>
                    <th className="text-right p-3 font-semibold text-sm">High-Fit</th>
                    <th className="text-center p-3 font-semibold text-sm">% High-Fit</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsTableRows.map((row) => {
                    const Icon = row.icon;
                    const pct = calculatePercentage(row.highFit, row.total);
                    return (
                      <tr
                        key={row.source}
                        className={cn(
                          "border-b transition-colors",
                          !row.isTAM && "cursor-pointer hover:bg-muted/50",
                          row.isTAM && "bg-muted/20"
                        )}
                        onClick={() => !row.isTAM && navigate(row.route)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <span>{row.source}</span>
                                {row.source === 'CRM' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Building2 className="h-3 w-3 mr-1" />
                                    Salesforce/HubSpot
                                  </Badge>
                                )}
                                {row.source === 'Database' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Database className="h-3 w-3 mr-1" />
                                    Your Data
                                  </Badge>
                                )}
                              </div>
                              {row.hasExternalTAM && (
                                <span className="text-xs text-muted-foreground">
                                  {row.tamCount?.toLocaleString()} available from external sources
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="text-right p-3 font-mono text-sm">
                          {row.total.toLocaleString()}
                        </td>
                        <td className="text-right p-3 font-mono text-sm font-semibold">
                          {row.isTAM ? "—" : row.highFit.toLocaleString()}
                        </td>
                        <td className="text-center p-3">
                          {row.isTAM ? (
                            <Badge variant="outline" className="text-muted-foreground">
                              N/A
                            </Badge>
                          ) : (
                            <Badge
                              className={cn("font-semibold border", getFitBadgeStyles(pct))}
                            >
                              {pct}%
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground mt-3">
          Click any row to view filtered data. High-Fit = Score ≥ 70
        </p>
      </CardContent>
    </Card>
  );
}