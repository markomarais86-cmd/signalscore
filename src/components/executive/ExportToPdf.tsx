import { Button } from "@/components/ui/button";
import { Download, FileText, Presentation, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useBrandedReport } from "@/hooks/use-branded-report";

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

  const handlePdfExport = async () => {
    await generateReport();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={isGenerating}>
          {isGenerating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          {isGenerating ? 'Generating...' : 'Export Report'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handlePdfExport} disabled={isGenerating}>
          <FileText className="h-4 w-4 mr-2" />
          Board PDF Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('pptx')}>
          <Presentation className="h-4 w-4 mr-2" />
          PowerPoint (Soon)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('csv')}>
          <Download className="h-4 w-4 mr-2" />
          Raw Data CSV (Soon)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
