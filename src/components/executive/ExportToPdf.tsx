import { Button } from "@/components/ui/button";
import { Download, FileText, Presentation } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size}>
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => onExport('pdf')}>
          <FileText className="h-4 w-4 mr-2" />
          Board PDF Report
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('pptx')}>
          <Presentation className="h-4 w-4 mr-2" />
          PowerPoint Slides
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onExport('csv')}>
          <Download className="h-4 w-4 mr-2" />
          Raw Data (CSV)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}