import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Database, Cloud } from "lucide-react";

interface SimpleICPTableProps {
  crmAccounts: number;
  databaseAccounts: number;
  highFitCrmAccounts: number;
  highFitDatabaseAccounts: number;
  medFitCrmAccounts: number;
  medFitDatabaseAccounts: number;
  apolloAccounts?: number;
  apolloHighFitEstimate?: number;
  apolloMedFitEstimate?: number;
  className?: string;
}

export function SimpleICPTable({
  crmAccounts, databaseAccounts,
  highFitCrmAccounts, highFitDatabaseAccounts,
  medFitCrmAccounts, medFitDatabaseAccounts,
  apolloAccounts, apolloHighFitEstimate, apolloMedFitEstimate,
  className,
}: SimpleICPTableProps) {
  const navigate = useNavigate();
  const crmIcpFit = highFitCrmAccounts + medFitCrmAccounts;
  const crmPercentage = crmAccounts > 0 ? Math.round((crmIcpFit / crmAccounts) * 100) : 0;

  const effectiveDatabaseAccounts = apolloAccounts ?? databaseAccounts;
  const effectiveHighFitDatabase = apolloHighFitEstimate ?? highFitDatabaseAccounts;
  const effectiveMedFitDatabase = apolloMedFitEstimate ?? medFitDatabaseAccounts;
  const dbIcpFit = effectiveHighFitDatabase + effectiveMedFitDatabase;
  const databasePercentage = effectiveDatabaseAccounts > 0 ? Math.round((dbIcpFit / effectiveDatabaseAccounts) * 100) : 0;

  const data = [
    { source: "CRM", icon: Cloud, total: crmAccounts, icpFit: crmIcpFit, percentage: crmPercentage },
    { source: "Database", icon: Database, total: effectiveDatabaseAccounts, icpFit: dbIcpFit, percentage: databasePercentage, isExternal: !!apolloAccounts },
  ];

  return (
    <Card className={`${className ?? ""} border bg-card`}>
      <CardContent className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">ICP by Source</h3>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-28 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Source</TableHead>
              <TableHead className="text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">Scored</TableHead>
              <TableHead className="text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">ICP-Fit</TableHead>
              <TableHead className="text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={row.source}
                className="cursor-pointer border-border transition-colors hover:bg-muted/20"
                onClick={() => navigate(`/accounts?source=${row.source.toLowerCase()}`)}
              >
                <TableCell className="py-3">
                  <div className="flex items-center gap-1.5">
                    <row.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{row.source}</span>
                    {row.isExternal && (
                      <span className="rounded border px-1 py-0.5 text-[9px] text-muted-foreground">est.</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs font-mono text-foreground tabular-nums">{row.total.toLocaleString()}</TableCell>
                <TableCell className="text-right text-xs font-mono text-foreground tabular-nums">{row.icpFit.toLocaleString()}</TableCell>
                <TableCell className="text-right text-xs font-mono text-foreground tabular-nums">{row.percentage}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
