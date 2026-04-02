import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, FileSpreadsheet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBrandedReport } from "@/hooks/use-branded-report";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { exportToExcel } from "@/utils/exportToExcel";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ExportToPdfProps {
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportToPdf({ 
  variant = "outline",
  size = "sm"
}: ExportToPdfProps) {
  const { generateReport, isGenerating } = useBrandedReport();
  const { effectiveOrgId } = useEffectiveOrg();
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);

  const handlePdfExport = async () => {
    await generateReport();
  };

  const handleExcelExport = async () => {
    if (!effectiveOrgId) return;
    setIsExportingExcel(true);
    try {
      await exportToExcel({ orgId: effectiveOrgId });
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handleCsvExport = async () => {
    if (!effectiveOrgId) return;
    setIsExportingCsv(true);
    try {
      const { data: accounts, error } = await supabase
        .from("accounts")
        .select("external_id, name, domain, industry_norm, revenue_range, employee_count, country, icp_qualified, propensity_score, enriched_at")
        .eq("org_id", effectiveOrgId)
        .limit(10000);

      if (error) throw error;
      if (!accounts || accounts.length === 0) {
        toast.info("No accounts to export");
        return;
      }

      const headers = Object.keys(accounts[0]);
      const csvRows = [
        headers.join(","),
        ...accounts.map(row =>
          headers.map(h => {
            const val = (row as Record<string, unknown>)[h];
            const str = val == null ? "" : String(val);
            return str.includes(",") || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
          }).join(",")
        ),
      ];
      const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `accounts-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${accounts.length} accounts`);
    } catch (err) {
      toast.error("CSV export failed");
      console.error(err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  const isBusy = isGenerating || isExportingExcel || isExportingCsv;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={isBusy}>
          {isBusy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {isGenerating ? 'Generating...' : isExportingExcel ? 'Exporting...' : isExportingCsv ? 'Exporting...' : 'Export Report'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={handlePdfExport} disabled={isBusy}>
          <FileText className="h-4 w-4 mr-2" />
          Board PDF Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExcelExport} disabled={isBusy}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Full Data Export (Excel)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCsvExport} disabled={isBusy}>
          <Download className="h-4 w-4 mr-2" />
          Raw Data CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
