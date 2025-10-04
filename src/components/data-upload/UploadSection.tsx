import { useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FileText, Download, MapPin, AlertCircle, CheckCircle, Info, RefreshCw, Database } from "lucide-react";

interface UploadResult {
  total: number;
  inserted: number;
  updated: number;
  rejected: number;
  errors: string[];
}

interface UploadSectionProps {
  type: 'accounts' | 'contacts' | 'leads';
  headers: string[];
  uploading: boolean;
  uploadProgress: number;
  uploadResult: UploadResult | null;
  onFileSelect: (file: File) => void;
  onDownloadTemplate: () => void;
  onDownloadRejections: () => void;
  onRerunMatching?: () => void;
  isExternalDatabase?: boolean;
  onExternalDatabaseChange?: (value: boolean) => void;
}

export function UploadSection({
  type,
  headers,
  uploading,
  uploadProgress,
  uploadResult,
  onFileSelect,
  onDownloadTemplate,
  onDownloadRejections,
  onRerunMatching,
  isExternalDatabase = false,
  onExternalDatabaseChange
}: UploadSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload {type === 'accounts' ? 'Accounts' : type === 'contacts' ? 'Contacts' : 'Leads'}
        </CardTitle>
        <CardDescription>
          {type === 'accounts' 
            ? 'Import company/account data to build your pipeline'
            : type === 'contacts'
            ? 'Import contact data linked to your accounts'
            : 'Import lead data with contact and company information'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Required headers:</strong> {headers.join(', ')}
            {type === 'contacts' && (
              <>
                <br />
                <strong>Note:</strong> account_external_id must match an existing account's external_id
              </>
            )}
          </AlertDescription>
        </Alert>

        {type === 'leads' && onExternalDatabaseChange && (
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/50">
            <Database className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <Label htmlFor="external-db" className="text-sm font-medium">
                External Database Upload (ZoomInfo, Apollo, Cognism)
              </Label>
              <p className="text-xs text-muted-foreground mt-1">
                Enable this if uploading from an external data provider. Accounts will be marked as "database" source and matched to existing CRM accounts.
              </p>
            </div>
            <Switch
              id="external-db"
              checked={isExternalDatabase}
              onCheckedChange={onExternalDatabaseChange}
              disabled={uploading}
            />
          </div>
        )}

        <div className="flex gap-4">
          <Button 
            variant="outline" 
            onClick={onDownloadTemplate}
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
                if (file) onFileSelect(file);
              }}
              className="hidden"
            />
            <Button 
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              <MapPin className="h-4 w-4 mr-2" />
              {uploading ? 'Processing...' : 'Upload & Map Fields'}
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{uploadResult.total}</div>
                <div className="text-sm text-muted-foreground">Total Rows</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[hsl(var(--signal-high))]">{uploadResult.inserted}</div>
                <div className="text-sm text-muted-foreground">Inserted</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{uploadResult.updated}</div>
                <div className="text-sm text-muted-foreground">Updated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[hsl(var(--signal-low))]">{uploadResult.rejected}</div>
                <div className="text-sm text-muted-foreground">Rejected</div>
              </div>
            </div>

            {uploadResult.errors.length > 0 && (
              <div className="space-y-2">
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {uploadResult.rejected} rows were rejected due to validation errors.
                  </AlertDescription>
                </Alert>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onDownloadRejections}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Rejections
                </Button>
              </div>
            )}

            {uploadResult.rejected === 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  All rows were processed successfully!
                </AlertDescription>
              </Alert>
            )}

            {type === 'leads' && onRerunMatching && (
              <div className="pt-4 border-t space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRerunMatching}
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Re-run Lead Matching & Scoring
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Match existing leads to accounts and auto-score them
                </p>
              </div>
            )}
          </div>
        )}
        </CardContent>
      </Card>
  );
}
