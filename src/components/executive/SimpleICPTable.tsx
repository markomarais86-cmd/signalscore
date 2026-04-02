import { useNavigate } from "react-router-dom";

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
  const crmPct = crmAccounts > 0 ? Math.round((crmIcpFit / crmAccounts) * 100) : 0;

  const dbTotal = apolloAccounts ?? databaseAccounts;
  const dbHigh = apolloHighFitEstimate ?? highFitDatabaseAccounts;
  const dbMed = apolloMedFitEstimate ?? medFitDatabaseAccounts;
  const dbIcpFit = dbHigh + dbMed;
  const dbPct = dbTotal > 0 ? Math.round((dbIcpFit / dbTotal) * 100) : 0;

  const rows = [
    { source: "CRM", total: crmAccounts, fit: crmIcpFit, pct: crmPct },
    { source: "Database", total: dbTotal, fit: dbIcpFit, pct: dbPct },
  ];

  return (
    <div className={className}>
      <div className="grid grid-cols-4 gap-0 border-b px-4 py-2.5">
        <span className="text-[11px] font-medium text-muted-foreground/70">Source</span>
        <span className="text-right text-[11px] font-medium text-muted-foreground/70">Scored</span>
        <span className="text-right text-[11px] font-medium text-muted-foreground/70">ICP fit</span>
        <span className="text-right text-[11px] font-medium text-muted-foreground/70">Share</span>
      </div>
      {rows.map((r) => (
        <button
          key={r.source}
          type="button"
          className="grid w-full grid-cols-4 items-center gap-0 border-b px-4 py-3 text-left transition-colors hover:bg-muted/10 last:border-b-0"
          onClick={() => navigate(`/accounts?source=${r.source.toLowerCase()}`)}
        >
          <span className="text-[13px] font-medium text-foreground">{r.source}</span>
          <span className="text-right text-[13px] font-medium text-foreground tabular-nums">{r.total.toLocaleString()}</span>
          <span className="text-right text-[13px] font-medium text-foreground tabular-nums">{r.fit.toLocaleString()}</span>
          <span className="text-right text-[13px] font-medium text-primary tabular-nums">{r.pct}%</span>
        </button>
      ))}
    </div>
  );
}
