import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AccountsLeadsTableProps {
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
  
  // ICP support (future)
  icpProfiles?: Array<{ id: string; name: string }>;
}

export function AccountsLeadsTable({
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
  icpProfiles = []
}: AccountsLeadsTableProps) {
  const navigate = useNavigate();
  const [selectedIcp, setSelectedIcp] = useState<string>("all");

  const calculatePercentage = (value: number, total: number) => {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 70) return "text-executive-green";
    if (percentage >= 50) return "text-executive-amber";
    return "text-executive-red";
  };

  const tableRows = [
    {
      source: "CRM",
      icon: Building2,
      accounts: { total: crmAccounts, highFit: highFitCrmAccounts },
      leads: { total: crmLeads, highFit: highFitCrmLeads },
      route: "/accounts?source=crm"
    },
    {
      source: "Database",
      icon: Users,
      accounts: { total: databaseAccounts, highFit: highFitDatabaseAccounts },
      leads: { total: databaseLeads, highFit: highFitDatabaseLeads },
      route: "/accounts?source=database"
    },
    {
      source: "Total",
      icon: TrendingUp,
      accounts: { total: totalAccounts, highFit: highFitAccounts },
      leads: { total: totalLeads, highFit: highFitLeads },
      route: "/accounts",
      isTotal: true
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Accounts & Leads Overview
        </CardTitle>
        <CardDescription>
          Unified view of accounts and leads by data source with high-fit breakdowns
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* ICP Filter Pills */}
        {icpProfiles.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Badge 
              variant={selectedIcp === "all" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedIcp("all")}
            >
              All ICPs
            </Badge>
            {icpProfiles.map(icp => (
              <Badge 
                key={icp.id}
                variant={selectedIcp === icp.id ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedIcp(icp.id)}
              >
                {icp.name}
              </Badge>
            ))}
          </div>
        )}

        {/* Compact Table */}
        <div className="mt-0">
            <div className="rounded-lg border">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left p-3 font-semibold text-sm">Source</th>
                      <th className="text-right p-3 font-semibold text-sm">Accounts (Total / High-Fit)</th>
                      <th className="text-center p-3 font-semibold text-sm">% High-Fit</th>
                      <th className="text-right p-3 font-semibold text-sm">Leads (Total / High-Fit)</th>
                      <th className="text-center p-3 font-semibold text-sm">% High-Fit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => {
                      const Icon = row.icon;
                      const accountsHighFitPct = calculatePercentage(row.accounts.highFit, row.accounts.total);
                      const leadsHighFitPct = calculatePercentage(row.leads.highFit, row.leads.total);

                      return (
                        <tr
                          key={row.source}
                          className={cn(
                            "border-b transition-colors cursor-pointer hover:bg-muted/50",
                            row.isTotal && "bg-muted/20 font-semibold"
                          )}
                          onClick={() => navigate(row.route)}
                        >
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                              <span>{row.source}</span>
                            </div>
                          </td>
                          <td className="text-right p-3 font-mono text-sm">
                            {row.accounts.total.toLocaleString()} / {row.accounts.highFit.toLocaleString()}
                          </td>
                          <td className="text-center p-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-semibold",
                                getPercentageColor(accountsHighFitPct)
                              )}
                            >
                              {accountsHighFitPct}%
                            </Badge>
                          </td>
                          <td className="text-right p-3 font-mono text-sm">
                            {row.leads.total.toLocaleString()} / {row.leads.highFit.toLocaleString()}
                          </td>
                          <td className="text-center p-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "font-semibold",
                                getPercentageColor(leadsHighFitPct)
                              )}
                            >
                              {leadsHighFitPct}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              Click any row to view filtered accounts or leads
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
