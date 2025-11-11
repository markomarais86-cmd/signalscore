import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Upload, Database, Sparkles } from "lucide-react";
import { useCampaignReady } from "@/hooks/use-campaign-ready";
import { Skeleton } from "@/components/ui/skeleton";

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
                disabled
              >
                <Download className="h-6 w-6" />
                <div className="text-center">
                  <div className="font-semibold">Export CSV</div>
                  <div className="text-xs text-muted-foreground">Coming Soon</div>
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
