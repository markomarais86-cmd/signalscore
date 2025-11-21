import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Users, TrendingUp, Database, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ICPCoverageCardProps {
  // Accounts data
  totalAccounts: number;
  crmAccounts: number;
  databaseAccounts: number;
  highFitAccounts: number;
  highFitCrmAccounts: number;
  highFitDatabaseAccounts: number;
  mediumFitAccounts: number;
  mediumFitCrmAccounts: number;
  mediumFitDatabaseAccounts: number;
  lowFitAccounts: number;
  lowFitCrmAccounts: number;
  lowFitDatabaseAccounts: number;
  
  // Leads data (optional - deprecated in account-centric workflow)
  totalLeads?: number;
  crmLeads?: number;
  databaseLeads?: number;
  highFitLeads?: number;
  highFitCrmLeads?: number;
  highFitDatabaseLeads?: number;
  mediumFitCrmLeads?: number;
  mediumFitDatabaseLeads?: number;
  lowFitCrmLeads?: number;
  lowFitDatabaseLeads?: number;

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
  mediumFitAccounts,
  mediumFitCrmAccounts,
  mediumFitDatabaseAccounts,
  lowFitAccounts,
  lowFitCrmAccounts,
  lowFitDatabaseAccounts,
  totalLeads = 0,
  crmLeads = 0,
  databaseLeads = 0,
  highFitLeads = 0,
  highFitCrmLeads = 0,
  highFitDatabaseLeads = 0,
  mediumFitCrmLeads = 0,
  mediumFitDatabaseLeads = 0,
  lowFitCrmLeads = 0,
  lowFitDatabaseLeads = 0,
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

  const accountsFitTableRows = [
    {
      fitLevel: "High Fit",
      total: highFitAccounts,
      crm: highFitCrmAccounts,
      database: highFitDatabaseAccounts,
      color: "text-fit-high",
      bgColor: "bg-fit-high/10"
    },
    {
      fitLevel: "Medium Fit",
      total: mediumFitAccounts,
      crm: mediumFitCrmAccounts,
      database: mediumFitDatabaseAccounts,
      color: "text-fit-medium",
      bgColor: "bg-fit-medium/10"
    },
    {
      fitLevel: "Low Fit",
      total: lowFitAccounts,
      crm: lowFitCrmAccounts,
      database: lowFitDatabaseAccounts,
      color: "text-fit-low",
      bgColor: "bg-fit-low/10"
    }
  ];

  const leadsFitTableRows = [
    {
      fitLevel: "High Fit",
      total: highFitLeads,
      crm: highFitCrmLeads,
      database: highFitDatabaseLeads,
      color: "text-fit-high",
      bgColor: "bg-fit-high/10"
    },
    {
      fitLevel: "Medium Fit",
      total: mediumFitCrmLeads + mediumFitDatabaseLeads,
      crm: mediumFitCrmLeads,
      database: mediumFitDatabaseLeads,
      color: "text-fit-medium",
      bgColor: "bg-fit-medium/10"
    },
    {
      fitLevel: "Low Fit",
      total: lowFitCrmLeads + lowFitDatabaseLeads,
      crm: lowFitCrmLeads,
      database: lowFitDatabaseLeads,
      color: "text-fit-low",
      bgColor: "bg-fit-low/10"
    }
  ];

  const accountsTableRows = [
    {
      source: "CRM",
      icon: Building2,
      total: crmAccounts,
      highFit: highFitCrmAccounts,
      route: "/accounts?source=crm",
      isTAM: false,
      tooltip: "Accounts from your connected CRM (Salesforce, HubSpot, etc.)"
    },
    {
      source: "Imported Accounts",
      icon: Database,
      total: databaseAccounts,
      highFit: highFitDatabaseAccounts,
      route: "/accounts?source=database",
      isTAM: false,
      tooltip: "Previously redeemed contacts from Apollo or other imports"
    },
    ...(tamAccounts > 0 ? [{
      source: `Available Market (${tamProvider || 'Apollo'})`,
      icon: Users,
      total: tamAccounts,
      highFit: 0,
      route: "#",
      isTAM: true,
      tooltip: "Total accounts matching your ICP in Apollo's database - not yet imported. Use Campaign Builder to import specific contacts."
    }] : [])
  ];

  const leadsTableRows = [
    {
      source: "CRM",
      icon: Building2,
      total: crmLeads,
      highFit: highFitCrmLeads,
      route: "/leads?source=crm",
      isTAM: false,
      tooltip: "Contacts from your connected CRM (Salesforce, HubSpot, etc.)"
    },
    {
      source: "Imported Accounts",
      icon: Database,
      total: databaseLeads,
      highFit: highFitDatabaseLeads,
      route: "/leads?source=database",
      isTAM: false,
      tooltip: "Previously redeemed contacts from Apollo or other imports"
    },
    ...(tamLeads > 0 ? [{
      source: `Available Market (${tamProvider || 'Apollo'})`,
      icon: Users,
      total: tamLeads,
      highFit: 0,
      route: "#",
      isTAM: true,
      tooltip: "Total contacts matching your ICP in Apollo's database - not yet imported. Use Campaign Builder to import specific contacts."
    }] : [])
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          ICP Coverage Overview
        </CardTitle>
        <CardDescription>
          Your CRM data, imported accounts, and available market from external databases
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
                          row.isTAM && "bg-muted/20 border-dashed"
                        )}
                        onClick={() => !row.isTAM && navigate(row.route)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", row.isTAM ? "text-primary" : "text-muted-foreground")} />
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-1">
                                        <span className={cn(row.isTAM && "text-primary font-medium")}>{row.source}</span>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="max-w-xs">{row.tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {row.source === 'CRM' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Building2 className="h-3 w-3 mr-1" />
                                    Salesforce/HubSpot
                                  </Badge>
                                )}
                                {row.source === 'Imported Accounts' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Database className="h-3 w-3 mr-1" />
                                    Imported
                                  </Badge>
                                )}
                                {row.isTAM && (
                                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                    Not Imported
                                  </Badge>
                                )}
                              </div>
                              {row.source === 'Imported Accounts' && databaseAccounts === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  No imported accounts yet. Import contacts from Apollo via Campaign Builder to see them here.
                                </p>
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
                          row.isTAM && "bg-muted/20 border-dashed"
                        )}
                        onClick={() => !row.isTAM && navigate(row.route)}
                      >
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Icon className={cn("h-4 w-4", row.isTAM ? "text-primary" : "text-muted-foreground")} />
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div className="flex items-center gap-1">
                                        <span className={cn(row.isTAM && "text-primary font-medium")}>{row.source}</span>
                                        <Info className="h-3 w-3 text-muted-foreground" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p className="max-w-xs">{row.tooltip}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                {row.source === 'CRM' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Building2 className="h-3 w-3 mr-1" />
                                    Salesforce/HubSpot
                                  </Badge>
                                )}
                                {row.source === 'Imported Accounts' && (
                                  <Badge variant="outline" className="text-xs">
                                    <Database className="h-3 w-3 mr-1" />
                                    Imported
                                  </Badge>
                                )}
                                {row.isTAM && (
                                  <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                                    Not Imported
                                  </Badge>
                                )}
                              </div>
                              {row.source === 'Imported Accounts' && databaseLeads === 0 && (
                                <p className="text-xs text-muted-foreground">
                                  No imported contacts yet. Import contacts from Apollo via Campaign Builder to see them here.
                                </p>
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