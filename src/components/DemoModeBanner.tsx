import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Database, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { useToast } from "@/hooks/use-toast";

export function DemoModeBanner() {
  const { flags, updateFlag } = useFeatureFlags();
  const { toast } = useToast();

  if (!flags.demo_mode) return null;

  const handleDisable = async () => {
    try {
      await updateFlag('demo_mode', false);
      toast({
        title: "Demo mode disabled",
        description: "Switched to live data mode"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to disable demo mode",
        variant: "destructive"
      });
    }
  };

  return (
    <Alert className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <Database className="h-4 w-4 text-amber-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300">
            Demo Mode Active
          </Badge>
          <span className="text-sm text-amber-800 dark:text-amber-200">
            You're viewing sample data. Real database operations are disabled.
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDisable}
          className="hover:bg-amber-100 dark:hover:bg-amber-900"
        >
          <X className="h-4 w-4" />
          Disable
        </Button>
      </AlertDescription>
    </Alert>
  );
}
