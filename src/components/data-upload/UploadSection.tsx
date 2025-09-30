import { useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { FileText, Download, MapPin, AlertCircle, CheckCircle, Info } from "lucide-react";

interface UploadResult {
  total: number;
  inserted: number;
  updated: number;
  rejected: number;
  errors: string[];
}

interface UploadSectionProps {
  type: 'accounts' | 'contacts';
  headers: string[];
  uploading: boolean;
  uploadProgress: number;
  uploadResult: UploadResult | null;
  onFileSelect: (file: File) => void;
  onDownloadTemplate: () => void;
  onDownloadRejections: () => void;
}

export function UploadSection({
  type,
  headers,
  uploading,
  uploadProgress,
  uploadResult,
  onFileSelect,
  onDownloadTemplate,
  onDownloadRejections
}: UploadSectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Upload {type === 'accounts' ? 'Accounts' : 'Contacts'}
        </CardTitle>
        <CardDescription>
          {type === 'accounts' 
            ? 'Import company/account data to build your pipeline'
            : 'Import contact data linked to your accounts'
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
          </div>
        )}
        </CardContent>
      </Card>
  );
}
