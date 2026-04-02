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
      <div className="space-y-3 px-5 pb-5 pt-2">
        {rows.map((r) => (
          <button
            key={r.source}
            type="button"
            className="source-row w-full"
            onClick={() => navigate(`/accounts?source=${r.source.toLowerCase()}`)}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="metric-panel__label">{r.source}</p>
                <p className="mt-2 font-heading text-[1.65rem] font-semibold tracking-[-0.05em] text-foreground tabular-nums">
                  {r.fit.toLocaleString()}
                </p>
              </div>

              <div className="text-right">
                <p className="metric-panel__label">Scored volume</p>
                <p className="mt-2 text-[13px] font-medium text-foreground tabular-nums">
                  {r.total.toLocaleString()}
                </p>
                <p className="mt-1 text-[12px] text-primary tabular-nums">{r.pct}% ICP fit</p>
              </div>
            </div>

            <div className="source-row__track mt-3">
              <div className="source-row__fill" style={{ width: `${Math.max(r.pct, 3)}%` }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
