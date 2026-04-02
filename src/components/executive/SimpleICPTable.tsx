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
  const crmPercentage = crmAccounts > 0 ? Math.round((crmIcpFit / crmAccounts) * 100) : 0;

  const effectiveDatabaseAccounts = apolloAccounts ?? databaseAccounts;
  const effectiveHighFitDatabase = apolloHighFitEstimate ?? highFitDatabaseAccounts;
  const effectiveMedFitDatabase = apolloMedFitEstimate ?? medFitDatabaseAccounts;
  const dbIcpFit = effectiveHighFitDatabase + effectiveMedFitDatabase;
  const databasePercentage = effectiveDatabaseAccounts > 0 ? Math.round((dbIcpFit / effectiveDatabaseAccounts) * 100) : 0;

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
    <Card className={`${className ?? ""} border bg-card shadow-sm`}>
      <CardContent className="p-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2">
              <Database className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">ICP Coverage by Source</h3>
              <p className="text-xs text-muted-foreground">Compare CRM vs database coverage quality.</p>
            </div>
          </div>
          <div className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-primary">
            2 sources
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-32 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Source</TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Scored</TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">ICP-Fit</TableHead>
              <TableHead className="text-right text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow
                key={row.source}
                className="cursor-pointer border-border transition-colors hover:bg-muted/20"
                onClick={() => navigate(`/accounts?source=${row.source.toLowerCase()}`)}
              >
                <TableCell className="py-4">
                  <div className="flex items-center gap-2">
                    <row.icon className="h-4 w-4 text-primary" />
                    <span className="font-medium text-foreground">{row.source}</span>
                    {row.isExternal && (
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary">
                        Apollo
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-foreground">{row.total.toLocaleString()}</TableCell>
                <TableCell className="text-right font-mono text-foreground">
                  {row.icpFit.toLocaleString()}
                  {row.isExternal && row.icpFit > 0 && (
                    <span className="ml-1 text-[10px] text-muted-foreground">est.</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <span className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
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
