import { Button } from "@/components/ui/button";
import { Download, FileText, Loader2, FileSpreadsheet } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBrandedReport } from "@/hooks/use-branded-report";
import { useNavigate } from "react-router-dom";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { exportToExcel } from "@/utils/exportToExcel";
import { useState } from "react";

interface ExportToPdfProps {
  onExport: (format: 'pdf' | 'pptx' | 'csv') => void;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportToPdf({ 
  onExport, 
  variant = "outline",
  size = "sm"
}: ExportToPdfProps) {
  const { generateReport, isGenerating } = useBrandedReport();
  const { effectiveOrgId } = useEffectiveOrg();
  const navigate = useNavigate();
  const [isExportingExcel, setIsExportingExcel] = useState(false);

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

  const isBusy = isGenerating || isExportingExcel;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={isBusy}>
          {isBusy ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {isGenerating ? 'Generating...' : isExportingExcel ? 'Exporting...' : 'Export Report'}
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
        <DropdownMenuItem onClick={() => onExport('csv')}>
          <Download className="h-4 w-4 mr-2" />
          Raw Data CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
