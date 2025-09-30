import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Download, 
  FileX, 
  BarChart3 
} from "lucide-react";

export interface ValidationResult {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  issues: ValidationIssue[];
  dataQuality: DataQualityScore;
  fieldAnalysis: FieldAnalysis[];
}

export interface ValidationIssue {
  row: number;
  field: string;
  type: 'error' | 'warning';
  message: string;
  value?: string;
  suggestion?: string;
}

export interface DataQualityScore {
  overall: number;
  completeness: number;
  accuracy: number;
  consistency: number;
  details: {
    missingValues: number;
    invalidFormats: number;
    duplicates: number;
  };
}

export interface FieldAnalysis {
  field: string;
  completeness: number;
  uniqueValues: number;
  commonValues: Array<{ value: string; count: number }>;
  dataType: 'string' | 'number' | 'email' | 'mixed';
  issues: string[];
}

interface DataValidationReportProps {
  result: ValidationResult;
  onDownloadReport: () => void;
  onDownloadCleanData: () => void;
  onDownloadErrors: () => void;
}

export function DataValidationReport({ 
  result, 
  onDownloadReport, 
  onDownloadCleanData, 
  onDownloadErrors 
}: DataValidationReportProps) {
  
  const getQualityColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getQualityBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-green-500">Excellent</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-500">Good</Badge>;
    return <Badge variant="destructive">Needs Improvement</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium">Valid Records</span>
              </div>
              <span className="text-2xl font-bold text-green-600">{result.valid}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {((result.valid / result.total) * 100).toFixed(2)}% of total
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium">Warnings</span>
              </div>
              <span className="text-2xl font-bold text-yellow-600">{result.warnings}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Can be imported with fixes
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="text-sm font-medium">Errors</span>
              </div>
              <span className="text-2xl font-bold text-red-600">{result.errors}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Must be fixed before import
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Data Quality</span>
              </div>
              <span className={`text-2xl font-bold ${getQualityColor(result.dataQuality.overall)}`}>
                {result.dataQuality.overall}%
              </span>
            </div>
            <div className="mt-1">
              {getQualityBadge(result.dataQuality.overall)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Quality Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Data Quality Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Completeness</span>
                <span className="text-sm">{result.dataQuality.completeness}%</span>
              </div>
              <Progress value={result.dataQuality.completeness} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Accuracy</span>
                <span className="text-sm">{result.dataQuality.accuracy}%</span>
              </div>
              <Progress value={result.dataQuality.accuracy} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Consistency</span>
                <span className="text-sm">{result.dataQuality.consistency}%</span>
              </div>
              <Progress value={result.dataQuality.consistency} className="h-2" />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-lg font-bold">{result.dataQuality.details.missingValues}</div>
              <div className="text-muted-foreground">Missing Values</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-lg font-bold">{result.dataQuality.details.invalidFormats}</div>
              <div className="text-muted-foreground">Format Issues</div>
            </div>
            <div className="text-center p-3 bg-muted rounded-lg">
              <div className="text-lg font-bold">{result.dataQuality.details.duplicates}</div>
              <div className="text-muted-foreground">Duplicates</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      <Tabs defaultValue="issues" className="w-full">
        <TabsList>
          <TabsTrigger value="issues">Issues ({result.issues.length})</TabsTrigger>
          <TabsTrigger value="fields">Field Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="issues" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Validation Issues</CardTitle>
            </CardHeader>
            <CardContent>
              {result.issues.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  No validation issues found!
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {result.issues.map((issue, index) => (
                    <div key={index} className="border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          {issue.type === 'error' ? (
                            <XCircle className="h-4 w-4 text-red-500 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                          )}
                          <div>
                            <div className="font-medium">Row {issue.row}: {issue.field}</div>
                            <div className="text-sm text-muted-foreground">{issue.message}</div>
                            {issue.value && (
                              <div className="text-xs bg-muted px-2 py-1 rounded mt-1 font-mono">
                                Value: "{issue.value}"
                              </div>
                            )}
                            {issue.suggestion && (
                              <div className="text-xs text-blue-600 mt-1">
                                💡 Suggestion: {issue.suggestion}
                              </div>
                            )}
                          </div>
                        </div>
                        <Badge variant={issue.type === 'error' ? 'destructive' : 'secondary'}>
                          {issue.type}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fields" className="space-y-4">
          <div className="grid gap-4">
            {result.fieldAnalysis.map(field => (
              <Card key={field.field}>
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-base">{field.field}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{field.dataType}</Badge>
                      <span className="text-sm text-muted-foreground">
                        {field.completeness}% complete
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Progress value={field.completeness} className="h-2" />
                  
                  <div className="flex justify-between text-sm">
                    <span>Unique Values: {field.uniqueValues}</span>
                  </div>

                  {field.commonValues.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-1">Most Common Values:</div>
                      <div className="flex flex-wrap gap-1">
                        {field.commonValues.slice(0, 5).map((item, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {item.value} ({item.count})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {field.issues.length > 0 && (
                    <div>
                      <div className="text-xs font-medium mb-1 text-red-600">Issues:</div>
                      <div className="space-y-1">
                        {field.issues.map((issue, index) => (
                          <div key={index} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            {issue}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Next Steps</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button onClick={onDownloadReport} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Download Full Report
            </Button>
            
            {result.valid > 0 && (
              <Button onClick={onDownloadCleanData}>
                <Download className="h-4 w-4 mr-2" />
                Download Clean Data ({result.valid} records)
              </Button>
            )}
            
            {result.errors > 0 && (
              <Button onClick={onDownloadErrors} variant="outline">
                <FileX className="h-4 w-4 mr-2" />
                Download Error Report
              </Button>
            )}
          </div>

          {result.errors > 0 && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>{result.errors} records have errors</strong> that must be fixed before import. 
                Download the error report to see details and fix your data.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}