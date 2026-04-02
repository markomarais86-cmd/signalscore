import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Database, Cloud } from "lucide-react";

interface SimpleICPTableProps {
  crmAccounts: number;
  databaseAccounts: number;
  highFitCrmAccounts: number;
  highFitDatabaseAccounts: number;
  medFitCrmAccounts: number;
  medFitDatabaseAccounts: number;
  // Apollo/external data for database source
  apolloAccounts?: number;
  apolloHighFitEstimate?: number;
  apolloMedFitEstimate?: number;
  className?: string;
}

export function SimpleICPTable({
  crmAccounts,
  databaseAccounts,
  highFitCrmAccounts,
  highFitDatabaseAccounts,
  medFitCrmAccounts,
  medFitDatabaseAccounts,
  apolloAccounts,
  apolloHighFitEstimate,
  apolloMedFitEstimate,
  className,
}: SimpleICPTableProps) {
  const navigate = useNavigate();
  const crmIcpFit = highFitCrmAccounts + medFitCrmAccounts;
  const crmPercentage = crmAccounts > 0 
    ? Math.round((crmIcpFit / crmAccounts) * 100) 
    : 0;
  
  // Use Apollo data if provided, otherwise fall back to internal database accounts
  const effectiveDatabaseAccounts = apolloAccounts ?? databaseAccounts;
  const effectiveHighFitDatabase = apolloHighFitEstimate ?? highFitDatabaseAccounts;
  const effectiveMedFitDatabase = apolloMedFitEstimate ?? medFitDatabaseAccounts;
  const dbIcpFit = effectiveHighFitDatabase + effectiveMedFitDatabase;
  
  const databasePercentage = effectiveDatabaseAccounts > 0 
    ? Math.round((dbIcpFit / effectiveDatabaseAccounts) * 100) 
    : 0;

  const data = [
    {
      source: "CRM",
      icon: Cloud,
      total: crmAccounts,
      icpFit: crmIcpFit,
      percentage: crmPercentage,
    },
    {
      source: "Database",
      icon: Database,
      total: effectiveDatabaseAccounts,
      icpFit: dbIcpFit,
      percentage: databasePercentage,
      isExternal: !!apolloAccounts,
    },
  ];

  return (
    <Card className={`${className} floating-card border-border/30 bg-card/90 backdrop-blur-xl shadow-xl shadow-primary/5 hover:shadow-2xl hover:shadow-primary/10 transition-all duration-500`}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-md bg-primary/10">
            <Database className="h-4 w-4 text-primary" />
          </div>
          <span className="text-sm font-medium text-muted-foreground">ICP Coverage by Source</span>
        </div>
        
        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="w-32 text-xs font-medium text-muted-foreground">Source</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground">Scored</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground">ICP-Fit</TableHead>
              <TableHead className="text-right text-xs font-medium text-muted-foreground">Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={row.source}
                className="border-border/50 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => navigate(`/accounts?source=${row.source.toLowerCase()}`)}
              >
                <TableCell className="py-4">
                  <div className="flex items-center gap-2">
                    <row.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-foreground">{row.source}</span>
                    {row.isExternal && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                        Apollo
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-foreground font-medium">
                  {row.total.toLocaleString()}
                </TableCell>
                <TableCell className="text-right text-foreground font-medium">
                  {row.icpFit.toLocaleString()}
                  {row.isExternal && row.icpFit > 0 && (
                    <span className="text-[10px] text-muted-foreground ml-1">est.</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
                    {row.percentage}% ICP-Fit
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}