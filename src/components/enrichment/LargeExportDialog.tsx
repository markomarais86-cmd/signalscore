import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Clock, Download, Loader2 } from "lucide-react";

interface LargeExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordCount: number;
  exportType: "accounts" | "leads";
  onDownloadNow: () => void;
  onExportInBackground: () => void;
  isExporting: boolean;
}

export function LargeExportDialog({
  open,
  onOpenChange,
  recordCount,
  exportType,
  onDownloadNow,
  onExportInBackground,
  isExporting,
}: LargeExportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Large Export Warning
          </DialogTitle>
          <DialogDescription>
            You're about to export <strong>{recordCount.toLocaleString()}</strong> {exportType}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border p-4 space-y-3">
            <h4 className="font-medium text-sm">Choose how to export:</h4>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-md bg-muted/50">
                <Download className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Download Now</p>
                  <p className="text-xs text-muted-foreground">
                    Process in your browser. May take 30+ seconds and could freeze your tab.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-md bg-primary/5 border border-primary/20">
                <Clock className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-sm">Export in Background</p>
                  <p className="text-xs text-muted-foreground">
                    Process on our servers. You'll get a notification when it's ready to download.
                  </p>
                  <span className="inline-block mt-1 text-xs text-primary font-medium">
                    ✓ Recommended for large exports
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onDownloadNow}
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Download Now
          </Button>
          <Button
            onClick={onExportInBackground}
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Clock className="h-4 w-4 mr-2" />
            )}
            Export in Background
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
