import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  Search, 
  CheckCheck, 
  RefreshCw,
  Building2,
  Clock,
  Filter,
  Inbox,
} from 'lucide-react';
import { 
  useEnrichmentReview, 
  PendingEnrichment,
  extractFieldChanges,
  FieldChange,
  FeedbackDecision,
} from '@/hooks/use-enrichment-review';
import { EnrichmentReviewModal } from './EnrichmentReviewModal';
import { cn } from '@/lib/utils';

export function AIFeedbackQueue() {
  const {
    pendingEnrichments,
    isLoading,
    refetch,
    submitFeedback,
    bulkAccept,
    pendingCount,
  } = useEnrichmentReview();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [selectedEnrichment, setSelectedEnrichment] = useState<PendingEnrichment | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // Filter enrichments
  const filteredEnrichments = pendingEnrichments.filter(e => {
    const matchesSearch = !searchQuery || 
      e.account_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.account_external_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesConfidence = confidenceFilter === 'all' ||
      (confidenceFilter === 'high' && (e.confidence || 0) >= 0.8) ||
      (confidenceFilter === 'medium' && (e.confidence || 0) >= 0.6 && (e.confidence || 0) < 0.8) ||
      (confidenceFilter === 'low' && (e.confidence || 0) < 0.6);

    return matchesSearch && matchesConfidence;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEnrichments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEnrichments.map(e => e.id)));
    }
  };

  const handleBulkAccept = async () => {
    await bulkAccept.mutateAsync(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleReview = (enrichment: PendingEnrichment) => {
    setSelectedEnrichment(enrichment);
    setModalOpen(true);
  };

  const handleSubmitFeedback = async (
    decision: FeedbackDecision, 
    changes: FieldChange[], 
    notes?: string
  ) => {
    if (!selectedEnrichment) return;

    await submitFeedback.mutateAsync({
      enrichmentId: selectedEnrichment.id,
      accountExternalId: selectedEnrichment.account_external_id,
      decision,
      fieldChanges: changes,
      feedbackNotes: notes,
    });

    setModalOpen(false);
    setSelectedEnrichment(null);
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (!confidence) return <Badge variant="outline">Unknown</Badge>;
    if (confidence >= 0.8) return <Badge className="bg-green-500/10 text-green-500">High</Badge>;
    if (confidence >= 0.6) return <Badge className="bg-yellow-500/10 text-yellow-500">Medium</Badge>;
    return <Badge className="bg-orange-500/10 text-orange-500">Low</Badge>;
  };

  const highConfidenceCount = filteredEnrichments.filter(e => (e.confidence || 0) >= 0.8).length;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <CardTitle>AI Enrichment Review Queue</CardTitle>
              {pendingCount > 0 && (
                <Badge variant="secondary">{pendingCount} pending</Badge>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by confidence" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Confidence</SelectItem>
                <SelectItem value="high">High (≥80%)</SelectItem>
                <SelectItem value="medium">Medium (60-80%)</SelectItem>
                <SelectItem value="low">Low (&lt;60%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg">
              <span className="text-sm font-medium">
                {selectedIds.size} selected
              </span>
              <Button
                size="sm"
                onClick={handleBulkAccept}
                disabled={bulkAccept.isPending}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Accept Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </Button>
            </div>
          )}

          {/* Quick Accept Banner */}
          {highConfidenceCount > 0 && selectedIds.size === 0 && (
            <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCheck className="h-4 w-4 text-green-500" />
                <span className="text-sm">
                  <strong>{highConfidenceCount}</strong> high-confidence suggestions ready for quick approval
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-green-500/30 text-green-600 hover:bg-green-500/10"
                onClick={() => {
                  const highConfIds = filteredEnrichments
                    .filter(e => (e.confidence || 0) >= 0.8)
                    .map(e => e.id);
                  setSelectedIds(new Set(highConfIds));
                }}
              >
                Select All High-Confidence
              </Button>
            </div>
          )}

          {/* Table */}
          {filteredEnrichments.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No pending enrichments to review</p>
              <p className="text-sm text-muted-foreground mt-1">
                Run AI enrichment to generate suggestions
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedIds.size === filteredEnrichments.length && filteredEnrichments.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Fields</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEnrichments.map((enrichment) => {
                    const changes = extractFieldChanges(enrichment);
                    return (
                      <TableRow key={enrichment.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(enrichment.id)}
                            onCheckedChange={() => toggleSelect(enrichment.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{enrichment.account_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {changes.length} field{changes.length !== 1 ? 's' : ''}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {getConfidenceBadge(enrichment.confidence)}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground capitalize">
                            {enrichment.provider}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {new Date(enrichment.created_at).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReview(enrichment)}
                          >
                            Review
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <EnrichmentReviewModal
        enrichment={selectedEnrichment}
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSubmit={handleSubmitFeedback}
        isSubmitting={submitFeedback.isPending}
      />
    </>
  );
}
