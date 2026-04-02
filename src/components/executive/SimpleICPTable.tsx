import { useNavigate } from "react-router-dom";
import { Cloud, Database } from "lucide-react";

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
  const crmPct = crmAccounts > 0 ? Math.round((crmIcpFit / crmAccounts) * 100) : 0;

  const dbTotal = apolloAccounts ?? databaseAccounts;
  const dbHigh = apolloHighFitEstimate ?? highFitDatabaseAccounts;
  const dbMed = apolloMedFitEstimate ?? medFitDatabaseAccounts;
  const dbIcpFit = dbHigh + dbMed;
  const dbPct = dbTotal > 0 ? Math.round((dbIcpFit / dbTotal) * 100) : 0;

  const rows = [
    { source: "CRM", icon: Cloud, total: crmAccounts, fit: crmIcpFit, pct: crmPct, est: false },
    { source: "Database", icon: Database, total: dbTotal, fit: dbIcpFit, pct: dbPct, est: !!apolloAccounts },
  ];

  return (
    <div className={`${className ?? ""} rounded-lg border bg-card`}>
      {/* Header */}
      <div className="grid grid-cols-4 gap-0 border-b px-4 py-2">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Source</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-right">Scored</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-right">ICP Fit</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-right">%</span>
      </div>
      {/* Rows */}
      {rows.map((r) => (
        <button
          key={r.source}
          type="button"
          className="grid w-full grid-cols-4 gap-0 items-center px-4 py-2.5 text-left transition-colors hover:bg-muted/10 border-b last:border-b-0"
          onClick={() => navigate(`/accounts?source=${r.source.toLowerCase()}`)}
        >
          <div className="flex items-center gap-1.5">
            <r.icon className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-foreground">{r.source}</span>
          </div>
          <span className="text-xs font-mono tabular-nums text-foreground text-right">{r.total.toLocaleString()}</span>
          <span className="text-xs font-mono tabular-nums text-foreground text-right">{r.fit.toLocaleString()}</span>
          <span className="text-xs font-mono tabular-nums text-foreground text-right">{r.pct}%</span>
        </button>
      ))}
    </div>
  );
}
