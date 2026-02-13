import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Database, Upload, Info, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseCSV } from "@/utils/csv-parser";
import { formatNumber } from "@/utils/format-numbers";

const CHUNK_SIZE = 5000;

export function ReferenceDBUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [result, setResult] = useState<{ upserted: number; skipped: number; total_in_database: number; errors: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    setProgress(0);
    setResult(null);

    try {
      setStatusText("Reading CSV...");
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        throw new Error("No data found in CSV");
      }

      const totalChunks = Math.ceil(rows.length / CHUNK_SIZE);
      let totalUpserted = 0;
      let totalSkipped = 0;
      const allErrors: string[] = [];
      let dbTotal = 0;

      setStatusText(`Parsed ${formatNumber(rows.length)} rows. Uploading in ${totalChunks} batches...`);

      for (let i = 0; i < totalChunks; i++) {
        const chunk = rows.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        setStatusText(`Uploading batch ${i + 1} of ${totalChunks}...`);
        setProgress(Math.round(((i) / totalChunks) * 100));

        const { data, error } = await supabase.functions.invoke('upload-master-data', {
          body: { rows: chunk },
        });

        if (error) {
          allErrors.push(`Batch ${i + 1}: ${error.message}`);
          continue;
        }

        totalUpserted += data.upserted || 0;
        totalSkipped += data.skipped || 0;
        allErrors.push(...(data.errors || []));
        dbTotal = data.total_in_database || dbTotal;
      }

      setProgress(100);
      setStatusText("Upload complete!");
      setResult({ upserted: totalUpserted, skipped: totalSkipped, total_in_database: dbTotal, errors: allErrors });

      toast({
        title: "Reference DB Upload Complete",
        description: `${formatNumber(totalUpserted)} records upserted. ${formatNumber(dbTotal)} total in database.`,
      });
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Reference Database (Master Account Data)
        </CardTitle>
        <CardDescription>
          Upload ZoomInfo or similar company data CSVs. Records are deduplicated by domain.
          Large files are chunked into {formatNumber(CHUNK_SIZE)}-row batches to avoid timeouts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Expected columns:</strong> Company, Website, Industry, No. of Employees, Annual Revenue, HQ City, HQ State, HQ Country, Founded Year, etc.
          </AlertDescription>
        </Alert>

        <div>
          <Input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = '';
            }}
            className="hidden"
          />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Uploading...' : 'Upload Reference CSV'}
          </Button>
        </div>

        {uploading && (
          <div className="space-y-2">
            <Progress value={progress} />
            <p className="text-sm text-muted-foreground">{statusText}</p>
          </div>
        )}

        {result && (
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm font-medium">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Upload Summary
            </div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{formatNumber(result.upserted)}</p>
                <p className="text-sm text-muted-foreground">Upserted</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(result.skipped)}</p>
                <p className="text-sm text-muted-foreground">Skipped (no domain)</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatNumber(result.total_in_database)}</p>
                <p className="text-sm text-muted-foreground">Total in DB</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  {result.errors.slice(0, 5).map((e, i) => <div key={i} className="text-xs">{e}</div>)}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
