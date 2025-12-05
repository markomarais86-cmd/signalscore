import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface DataQualityWarningProps {
  dataCompleteness: number;
  totalAccounts: number;
  onEnrich?: () => void;
}

export function DataQualityWarning({ 
  dataCompleteness, 
  totalAccounts,
  onEnrich 
}: DataQualityWarningProps) {
  const navigate = useNavigate();
  
  // Don't show if no accounts or good data quality (70%+)
  if (totalAccounts === 0 || dataCompleteness >= 70) {
    return null;
  }

  const missingPercent = Math.round(100 - dataCompleteness);

  return (
    <Alert className="bg-amber-500/10 border-amber-500/30">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertDescription className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm">
          <strong>Data Quality Alert:</strong> {missingPercent}% of accounts have incomplete data. Scores may be less accurate.
        </span>
        <div className="flex gap-2">
          {onEnrich && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onEnrich}
              className="border-amber-500/50 hover:bg-amber-500/10"
            >
              <Sparkles className="mr-1 h-3 w-3" />
              Enrich Data
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/settings?tab=enrichment')}
          >
            View Settings
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
