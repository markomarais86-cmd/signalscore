import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, Database, Sparkles, Settings2, Building2, Users, History } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCampaignReady } from "@/hooks/use-campaign-ready";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

interface CampaignExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  orgId: string;
  sourceFilter: 'all' | 'crm' | 'database';
  totalCampaignReady: number;
}

export function CampaignExportModal({
  isOpen,
  onClose,
  orgId,
  sourceFilter,
  totalCampaignReady
}: CampaignExportModalProps) {
  const { data, isLoading } = useCampaignReady(orgId, sourceFilter);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Filter state
  const [exportFormat, setExportFormat] = useState<'standard' | 'outreach' | 'salesloft'>('standard');
  const [minScore, setMinScore] = useState(70);
  const [maxScore, setMaxScore] = useState(100);
  const [selectedFitBands, setSelectedFitBands] = useState(['A', 'B']);
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  const [maxRecords, setMaxRecords] = useState(1000);
  const [includeUnverified, setIncludeUnverified] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<any>(null);

  const getSourceBadge = (source: string) => {
    if (source === 'crm') {
      return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">CRM</Badge>;
    }
    return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">Database</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Campaign-Ready Leads</DialogTitle>
          <DialogDescription>
            High-fit leads with complete contact information (email, title, persona)
          </DialogDescription>
        </DialogHeader>

        {/* Navigation Links */}
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              onClose();
              navigate('/accounts?campaign_ready=true');
            }}
          >
            <Building2 className="h-4 w-4 mr-2" />
            View Accounts
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              onClose();
              navigate('/leads?campaign_ready=yes');
            }}
          >
            <Users className="h-4 w-4 mr-2" />
            View All Contacts
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              onClose();
              navigate('/settings?tab=export-history');
            }}
          >
            <History className="h-4 w-4 mr-2" />
            Export History
          </Button>
        </div>

        <div className="space-y-6">
          {/* Overview Stats */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Overview
            </h3>
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-6 w-2/3" />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Campaign-Ready Leads</span>
                  <span className="text-3xl font-bold text-primary">{data?.total.toLocaleString() || 0}</span>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">From CRM</div>
                    <div className="text-2xl font-semibold flex items-center gap-2">
                      {data?.crm.toLocaleString() || 0}
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs">CRM</Badge>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground mb-1">From Database (Apollo)</div>
                    <div className="text-2xl font-semibold flex items-center gap-2">
                      {data?.database.toLocaleString() || 0}
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20 text-xs">Database</Badge>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Preview Table */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Preview (Top 10)</h3>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.preview.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No campaign-ready leads found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data?.preview.map((lead) => (
                        <TableRow key={lead.id}>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>{lead.company}</TableCell>
                          <TableCell>{lead.title}</TableCell>
                          <TableCell className="text-sm">{lead.email}</TableCell>
                          <TableCell>{getSourceBadge(lead.data_source)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Export Filters */}
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Settings2 className="h-5 w-5" />
              Export Filters
            </h3>
            <div className="space-y-6">
              {/* ICP Score Range Slider */}
              <div className="space-y-2">
                <Label>ICP Score Range: {minScore} - {maxScore}</Label>
                <Slider
                  min={0}
                  max={100}
                  step={5}
                  value={[minScore, maxScore]}
                  onValueChange={([min, max]) => {
                    setMinScore(min);
                    setMaxScore(max);
                  }}
                  className="w-full"
                />
              </div>

              {/* Fit Band Checkboxes */}
              <div className="space-y-2">
                <Label>Fit Bands</Label>
                <div className="flex gap-4">
                  {['A', 'B', 'C'].map(band => (
                    <div key={band} className="flex items-center gap-2">
                      <Checkbox
                        id={`band-${band}`}
                        checked={selectedFitBands.includes(band)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedFitBands([...selectedFitBands, band]);
                          } else {
                            setSelectedFitBands(selectedFitBands.filter(b => b !== band));
                          }
                        }}
                      />
                      <Label htmlFor={`band-${band}`} className="cursor-pointer">
                        Band {band} {band === 'A' ? '(85-100)' : band === 'B' ? '(70-84)' : '(50-69)'}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Max Records Input */}
              <div className="space-y-2">
                <Label htmlFor="maxRecords">Max Records</Label>
                <Input
                  id="maxRecords"
                  type="number"
                  value={maxRecords}
                  onChange={(e) => setMaxRecords(parseInt(e.target.value) || 1000)}
                  min={100}
                  max={10000}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: 500-1,000 per batch to avoid overwhelming SDRs
                </p>
              </div>

              {/* Export Format Selector */}
              <div className="space-y-2">
                <Label htmlFor="exportFormat">Export Format</Label>
                <Select value={exportFormat} onValueChange={(value: any) => setExportFormat(value)}>
                  <SelectTrigger id="exportFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard CSV</SelectItem>
                    <SelectItem value="outreach">Outreach Import Format</SelectItem>
                    <SelectItem value="salesloft">SalesLoft Import Format</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Include Unverified Checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="includeUnverified"
                  checked={includeUnverified}
                  onCheckedChange={(checked) => setIncludeUnverified(checked as boolean)}
                />
                <Label htmlFor="includeUnverified" className="cursor-pointer">
                  Include unverified emails (not recommended)
                </Label>
              </div>
            </div>
          </Card>

          {/* Export Result Summary */}
          {exportResult && (
            <Card className="p-4 bg-primary/5 border-primary/20">
              <h4 className="font-semibold text-primary mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Export Complete
              </h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="text-muted-foreground">Batch ID:</div>
                <div className="font-mono text-xs">{exportResult.batch_id}</div>
                <div className="text-muted-foreground">Total Queried:</div>
                <div>{exportResult.total_queried?.toLocaleString()}</div>
                <div className="text-muted-foreground">Exported:</div>
                <div className="font-semibold text-primary">{exportResult.export_count?.toLocaleString()}</div>
                <div className="text-muted-foreground">Skipped:</div>
                <div>{exportResult.skipped_count?.toLocaleString()}</div>
              </div>
              {exportResult.skip_reasons && (
                <div className="mt-3 pt-3 border-t text-xs text-muted-foreground space-y-1">
                  <div className="font-medium">Skip Reasons:</div>
                  {exportResult.skip_reasons.unverified > 0 && (
                    <div>• {exportResult.skip_reasons.unverified} unverified emails</div>
                  )}
                  {exportResult.skip_reasons.no_consent > 0 && (
                    <div>• {exportResult.skip_reasons.no_consent} no consent</div>
                  )}
                  {exportResult.skip_reasons.suppressed > 0 && (
                    <div>• {exportResult.skip_reasons.suppressed} suppressed</div>
                  )}
                  {exportResult.skip_reasons.duplicate > 0 && (
                    <div>• {exportResult.skip_reasons.duplicate} duplicates</div>
                  )}
                  {exportResult.skip_reasons.low_score > 0 && (
                    <div>• {exportResult.skip_reasons.low_score} below score threshold</div>
                  )}
                </div>
              )}
            </Card>
          )}

          {/* Export Options */}
          <div>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              Export Options
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                disabled
              >
                <Upload className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-semibold">Sync to CRM</div>
                  <div className="text-xs text-muted-foreground">Coming Soon</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                disabled={isExporting}
                onClick={async () => {
                  setIsExporting(true);
                  setExportResult(null);
                  try {
                    console.log('🚀 Starting CSV export...');
                    const { data: exportData, error } = await supabase.functions.invoke('export-campaign-csv', {
                      body: {
                        org_id: orgId,
                        filters: {
                          source_filter: sourceFilter,
                          min_score: minScore,
                          max_score: maxScore,
                          fit_bands: selectedFitBands,
                          personas: selectedPersonas,
                          max_records: maxRecords,
                          include_unverified: includeUnverified,
                          skip_consent_check: false
                        },
                        export_format: exportFormat
                      }
                    });

                    if (error) {
                      console.error('❌ Export error:', error);
                      throw error;
                    }

                    console.log('✅ Export successful:', exportData);

                    // Download CSV
                    const blob = new Blob([exportData.csv_data], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `campaign-export-${exportData.batch_id}.csv`;
                    a.click();
                    window.URL.revokeObjectURL(url);

                    setExportResult(exportData.metadata);
                    toast({
                      title: "Export Successful",
                      description: `Exported ${exportData.metadata.export_count} leads to CSV`,
                    });
                  } catch (err: any) {
                    console.error('❌ Export failed:', err);
                    toast({
                      title: "Export Failed",
                      description: err.message || "Please try again",
                      variant: "destructive"
                    });
                  } finally {
                    setIsExporting(false);
                  }
                }}
              >
                <Download className={`h-6 w-6 ${isExporting ? 'animate-spin' : ''}`} />
                <div className="text-center">
                  <div className="font-semibold">
                    {isExporting ? 'Exporting...' : 'Export CSV'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {exportFormat === 'outreach' ? 'Outreach Format' :
                     exportFormat === 'salesloft' ? 'SalesLoft Format' :
                     'Standard Format'}
                  </div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2"
                disabled
              >
                <Database className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-semibold">Reveal from Apollo</div>
                  <div className="text-xs text-muted-foreground">Coming Soon</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
