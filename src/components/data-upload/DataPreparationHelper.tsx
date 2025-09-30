import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertTriangle, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ValidationItem {
  field: string;
  status: 'success' | 'warning' | 'error';
  message: string;
}

interface DataPreparationHelperProps {
  dataType: 'easy' | 'detailed';
  requiredFields: string[];
  sampleData?: Record<string, string>[];
  accountCount?: number;
}

export function DataPreparationHelper({
  dataType,
  requiredFields,
  sampleData,
  accountCount = 0
}: DataPreparationHelperProps) {
  const getValidationChecklist = (): ValidationItem[] => {
    const checklist: ValidationItem[] = [];

    if (dataType === 'easy') {
      checklist.push({
        field: 'Domain Format',
        status: accountCount > 0 ? 'success' : 'warning',
        message: accountCount > 0 
          ? `${accountCount} accounts available for matching`
          : 'Upload accounts first to enable domain matching'
      });
      checklist.push({
        field: 'CSV Structure',
        status: 'success',
        message: 'Single column with "domain" header'
      });
      checklist.push({
        field: 'Data Completeness',
        status: 'success',
        message: 'Firmographics pulled automatically from accounts'
      });
    } else {
      checklist.push({
        field: 'Account IDs',
        status: accountCount > 0 ? 'success' : 'error',
        message: accountCount > 0
          ? 'Must match existing account_external_id values'
          : 'Upload accounts before uploading deals'
      });
      checklist.push({
        field: 'Deal Values',
        status: 'success',
        message: 'Numeric values (e.g., 50000, 75000)'
      });
      checklist.push({
        field: 'Close Dates',
        status: 'success',
        message: 'Format: YYYY-MM-DD (e.g., 2024-01-15)'
      });
      checklist.push({
        field: 'Sales Cycle',
        status: 'warning',
        message: 'Optional: Days as integers (e.g., 45, 60)'
      });
    }

    return checklist;
  };

  const getStatusIcon = (status: ValidationItem['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-[hsl(var(--signal-high))]" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-[hsl(var(--signal-medium))]" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-[hsl(var(--signal-low))]" />;
    }
  };

  const downloadDataFormat = () => {
    const formatDoc = dataType === 'easy' 
      ? `# Easy Mode CSV Format

## Required Column:
- domain: Website domain of the company (e.g., techcorp.com)

## Example:
domain
techcorp.com
dataflow.io
cloudscale.net

## Notes:
- Do not include http:// or https://
- Use the main company domain
- We'll automatically match to your accounts and pull all firmographics
- Unmatched domains will be reported
`
      : `# Detailed Mode CSV Format

## Required Columns:
- account_external_id: Must match your CRM's account ID
- deal_value: Numeric value in dollars (e.g., 50000)
- close_date: Date in YYYY-MM-DD format (e.g., 2024-01-15)
- sales_cycle_days: Integer (optional, e.g., 45)

## Example:
account_external_id,deal_value,close_date,sales_cycle_days
ACC001,50000,2024-01-15,45
ACC002,75000,2024-02-20,60

## Notes:
- Account IDs must exist in your accounts table
- Deal values should be in USD
- Dates must use YYYY-MM-DD format
- Sales cycle is optional but recommended
`;

    const blob = new Blob([formatDoc], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dataType}_mode_format_guide.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const checklist = getValidationChecklist();
  const hasErrors = checklist.some(item => item.status === 'error');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {dataType === 'easy' ? 'Easy Mode' : 'Detailed Mode'} Requirements
        </CardTitle>
        <CardDescription>
          {dataType === 'easy' 
            ? 'Quick domain-based matching with automatic firmographic enrichment'
            : 'Complete deal information for comprehensive analysis'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Validation Checklist */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Validation Checklist:</h4>
          <div className="space-y-2">
            {checklist.map((item, idx) => (
              <div 
                key={idx}
                className="flex items-start gap-3 p-2 rounded-lg bg-muted/30"
              >
                <div className="mt-0.5">{getStatusIcon(item.status)}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{item.field}</div>
                  <div className="text-xs text-muted-foreground">{item.message}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Required Fields */}
        <div>
          <h4 className="font-semibold text-sm mb-2">Required CSV Headers:</h4>
          <div className="flex flex-wrap gap-2">
            {requiredFields.map((field) => (
              <Badge key={field} variant="outline">
                {field}
              </Badge>
            ))}
          </div>
        </div>

        {/* Sample Data */}
        {sampleData && sampleData.length > 0 && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Example Format:</h4>
            <div className="bg-muted/50 p-3 rounded-md font-mono text-xs overflow-x-auto">
              <div className="text-primary font-bold">
                {requiredFields.join(',')}
              </div>
              {sampleData.map((row, idx) => (
                <div key={idx} className="text-muted-foreground">
                  {requiredFields.map(field => row[field]).join(',')}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadDataFormat}
          >
            <Download className="h-4 w-4 mr-2" />
            Format Guide
          </Button>
        </div>

        {/* Error Alert */}
        {hasErrors && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              Please resolve the errors above before uploading. You may need to upload account data first.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
