import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Trophy, Download, Info, CheckCircle, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { parseCSV } from "@/utils/csv-parser";

// Closed Won CSV headers
const CLOSED_WON_HEADERS = ['account_external_id', 'deal_value', 'close_date', 'sales_cycle_days'];

interface UploadResult {
  total: number;
  inserted: number;
  rejected: number;
  errors: string[];
}

export function ClosedWonUpload() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { userProfile } = useAuth();
  const { toast } = useToast();

  const downloadTemplate = () => {
    const template = [
      CLOSED_WON_HEADERS.join(','),
      'ACC001,50000,2024-01-15,45',
      'ACC002,75000,2024-02-20,60'
    ].join('\n');

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'closed_won_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleFileSelect = async (file: File) => {
    if (!userProfile?.org_id) {
      toast({
        title: "Error",
        description: "User profile not loaded",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setUploadResult(null);

    try {
      const text = await file.text();
      const rawData = parseCSV(text);
      
      setUploadProgress(25);

      // Validate required fields
      const validData = rawData.filter(row => {
        return row.account_external_id && row.deal_value && row.close_date;
      });

      const rejectedCount = rawData.length - validData.length;
      setUploadProgress(50);

      // Transform and insert data
      const transformedData = validData.map(row => ({
        org_id: userProfile.org_id,
        account_external_id: row.account_external_id,
        deal_value: parseFloat(row.deal_value) || 0,
        close_date: row.close_date,
        sales_cycle_days: parseInt(row.sales_cycle_days) || null,
        created_at: new Date().toISOString()
      }));

      setUploadProgress(75);

      // Note: You'll need to create a 'closed_won_deals' table in Supabase first
      // For now, we'll just simulate success
      const { error } = await supabase
        .from('closed_won_deals')
        .upsert(transformedData, { onConflict: 'org_id,account_external_id,close_date' });

      if (error) throw error;

      setUploadProgress(100);

      setUploadResult({
        total: rawData.length,
        inserted: validData.length,
        rejected: rejectedCount,
        errors: rejectedCount > 0 ? [`${rejectedCount} rows missing required fields`] : []
      });

      toast({
        title: "Upload completed",
        description: `Processed ${rawData.length} closed won deals`
      });

    } catch (error: any) {
      console.error('Upload error:', error);
      
      let errorMessage = "Failed to upload closed won data";
      if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        errorMessage = "Closed won deals table not yet created. Please contact support to enable this feature.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive"
      });
      
      setUploadResult({
        total: 0,
        inserted: 0,
        rejected: 0,
        errors: [errorMessage]
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Upload Closed Won Data
        </CardTitle>
        <CardDescription>
          Import historical closed won deals to analyze your ideal customer profile based on actual wins
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Required headers:</strong> {CLOSED_WON_HEADERS.join(', ')}
            <br />
            <strong>Note:</strong> account_external_id must match existing accounts in your CRM data
          </AlertDescription>
        </Alert>

        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={downloadTemplate}
          >
            <Download className="h-4 w-4 mr-2" />
            Download Template
          </Button>
          <div>
            <Input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
              }}
              className="hidden"
            />
            <Button 
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <Trophy className="h-4 w-4 mr-2" />
              {uploading ? 'Processing...' : 'Upload Closed Won Deals'}
            </Button>
          </div>
        </div>

        {uploading && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="w-full" />
            <p className="text-sm text-muted-foreground">Processing upload...</p>
          </div>
        )}

        {uploadResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{uploadResult.total}</div>
                <div className="text-sm text-muted-foreground">Total Deals</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[hsl(var(--signal-high))]">{uploadResult.inserted}</div>
                <div className="text-sm text-muted-foreground">Inserted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[hsl(var(--signal-low))]">{uploadResult.rejected}</div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </div>
            </div>

            {uploadResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {uploadResult.errors[0]}
                </AlertDescription>
              </Alert>
            )}

            {uploadResult.rejected === 0 && uploadResult.inserted > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All closed won deals were processed successfully! Your ICP analysis will now be based on real win data.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
