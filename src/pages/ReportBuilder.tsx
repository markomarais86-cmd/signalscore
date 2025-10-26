import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReports } from '@/hooks/use-reports';
import { FileText, Plus, Calendar, Download, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const REPORT_TEMPLATES = [
  { id: 'executive', name: 'Executive Summary', description: 'High-level KPIs and insights' },
  { id: 'sales', name: 'Sales Performance', description: 'Pipeline, conversion, and revenue metrics' },
  { id: 'icp', name: 'ICP Analysis', description: 'Account fit and segmentation breakdown' },
  { id: 'pipeline', name: 'Pipeline Health', description: 'Stage-by-stage funnel analysis' },
  { id: 'capital', name: 'Capital Efficiency', description: 'ROI, CAC, and investment metrics' },
];

export default function ReportBuilder() {
  const { reports, isLoading, createReport, deleteReport } = useReports();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [newReport, setNewReport] = useState({
    name: '',
    description: '',
    template_id: '',
    config: {},
  });

  const handleCreateReport = async () => {
    if (!newReport.name || !newReport.template_id) {
      toast({
        title: 'Validation Error',
        description: 'Please fill in report name and select a template',
        variant: 'destructive',
      });
      return;
    }

    await createReport(newReport);
    setNewReport({ name: '', description: '', template_id: '', config: {} });
    setIsCreating(false);
  };

  const handleExportReport = (reportId: string) => {
    toast({
      title: 'Export Started',
      description: 'Your report is being generated...',
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Report Builder</h1>
            <p className="text-muted-foreground mt-2">
              Create custom reports and schedule automated delivery
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
              <CardDescription>Configure your custom report settings</CardDescription>
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
                <Label htmlFor="template">Template</Label>
                <Select
                  value={newReport.template_id}
                  onValueChange={(value) => setNewReport({ ...newReport, template_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        <div>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-muted-foreground">{template.description}</div>
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
            return (
              <Card key={report.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <FileText className="h-8 w-8 text-primary" />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteReport(report.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardTitle className="text-lg">{report.name}</CardTitle>
                  <CardDescription>
                    {report.description || template?.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {template && (
                      <Badge variant="outline">{template.name}</Badge>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => handleExportReport(report.id)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Export
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        Schedule
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
                Create your first custom report to get started
              </p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Report
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
