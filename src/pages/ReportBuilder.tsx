import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReports } from '@/hooks/use-reports';
import { useAuth } from '@/hooks/use-auth';
import { FileText, Plus, Trash2, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  fetchReportData,
  TEMPLATE_GENERATORS,
  generateExcelReport,
  downloadBlob,
} from '@/lib/report-generator';

const REPORT_TEMPLATES = [
  { id: 'executive', name: 'Executive Summary', description: 'High-level KPIs and insights' },
  { id: 'sales', name: 'Sales Performance', description: 'Pipeline, conversion, and revenue metrics' },
  { id: 'icp', name: 'ICP Analysis', description: 'Account fit and segmentation breakdown' },
  { id: 'pipeline', name: 'Pipeline Health', description: 'Stage-by-stage funnel analysis' },
];

export default function ReportBuilder() {
  const { reports, isLoading, createReport, deleteReport } = useReports();
  const { userProfile } = useAuth();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [newReport, setNewReport] = useState({
    name: '',
    description: '',
    template_id: '',
    config: {},
  });

  const handleCreateReport = async () => {
    if (!newReport.name || !newReport.template_id) {
      toast({ title: 'Validation Error', description: 'Please fill in report name and select a template', variant: 'destructive' });
      return;
    }
    await createReport(newReport);
    setNewReport({ name: '', description: '', template_id: '', config: {} });
    setIsCreating(false);
  };

  const handleExport = async (reportId: string, templateId: string, reportName: string, format: 'pdf' | 'excel') => {
    if (!userProfile?.org_id) return;
    setExportingId(`${reportId}-${format}`);
    try {
      const data = await fetchReportData(userProfile.org_id);
      const safeName = reportName.replace(/[^a-zA-Z0-9_-]/g, '_');

      if (format === 'pdf') {
        const generator = TEMPLATE_GENERATORS[templateId] || TEMPLATE_GENERATORS.executive;
        const doc = generator(data);
        doc.save(`${safeName}.pdf`);
      } else {
        const blob = await generateExcelReport(data, templateId);
        downloadBlob(blob, `${safeName}.xlsx`);
      }

      toast({ title: 'Report Generated', description: `${reportName} exported as ${format.toUpperCase()}` });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({ title: 'Export Failed', description: error.message || 'Failed to generate report', variant: 'destructive' });
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Report Builder</h1>
          <p className="text-muted-foreground mt-2">
            Generate PDF & Excel reports from your live data
          </p>
        </div>
        <Button onClick={() => setIsCreating(!isCreating)}>
          <Plus className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create New Report</CardTitle>
            <CardDescription>Configure your report template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Report Name</Label>
              <Input
                id="name"
                placeholder="Q1 Executive Summary"
                value={newReport.name}
                onChange={(e) => setNewReport({ ...newReport, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Key metrics and insights for Q1..."
                value={newReport.description}
                onChange={(e) => setNewReport({ ...newReport, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Template</Label>
              <Select
                value={newReport.template_id}
                onValueChange={(value) => setNewReport({ ...newReport, template_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TEMPLATES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div>
                        <div className="font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateReport}>Create Report</Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => {
          const template = REPORT_TEMPLATES.find(t => t.id === report.template_id);
          const isPdfExporting = exportingId === `${report.id}-pdf`;
          const isXlExporting = exportingId === `${report.id}-excel`;
          return (
            <Card key={report.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <FileText className="h-8 w-8 text-primary" />
                  <Button variant="ghost" size="icon" onClick={() => deleteReport(report.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <CardTitle className="text-lg">{report.name}</CardTitle>
                <CardDescription>{report.description || template?.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {template && <Badge variant="outline">{template.name}</Badge>}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={!!exportingId}
                      onClick={() => handleExport(report.id, report.template_id || 'executive', report.name, 'pdf')}
                    >
                      {isPdfExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                      PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      disabled={!!exportingId}
                      onClick={() => handleExport(report.id, report.template_id || 'executive', report.name, 'excel')}
                    >
                      {isXlExporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-1" />}
                      Excel
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {reports.length === 0 && !isCreating && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create a report to generate PDF or Excel exports from your live data
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Report
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
