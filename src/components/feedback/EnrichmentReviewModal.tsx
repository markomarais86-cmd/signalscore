import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Check, 
  X, 
  Pencil, 
  Building2, 
  Sparkles,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { 
  PendingEnrichment, 
  FieldChange, 
  extractFieldChanges, 
  fieldDisplayNames,
  FeedbackDecision,
} from '@/hooks/use-enrichment-review';
import { cn } from '@/lib/utils';

interface EnrichmentReviewModalProps {
  enrichment: PendingEnrichment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (decision: FeedbackDecision, changes: FieldChange[], notes?: string) => void;
  isSubmitting: boolean;
}

export function EnrichmentReviewModal({
  enrichment,
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: EnrichmentReviewModalProps) {
  const [editMode, setEditMode] = useState(false);
  const [editedValues, setEditedValues] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState('');

  if (!enrichment) return null;

  const fieldChanges = extractFieldChanges(enrichment);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-500';
    if (confidence >= 0.6) return 'text-yellow-500';
    return 'text-orange-500';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  const handleAccept = () => {
    onSubmit('accepted', fieldChanges, notes || undefined);
  };

  const handleReject = () => {
    onSubmit('rejected', fieldChanges, notes || undefined);
  };

  const handleSaveEdits = () => {
    const modifiedChanges = fieldChanges.map(change => ({
      ...change,
      newValue: editedValues[change.field] ?? change.newValue,
    }));
    onSubmit('modified', modifiedChanges, notes || undefined);
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '—';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'number') return value.toLocaleString();
    return String(value);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review AI Enrichment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Account Info */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">{enrichment.account_name}</p>
              <p className="text-sm text-muted-foreground">
                {enrichment.provider} • {new Date(enrichment.created_at).toLocaleDateString()}
              </p>
            </div>
            {enrichment.confidence && (
              <Badge 
                variant="outline" 
                className={cn('ml-auto', getConfidenceColor(enrichment.confidence))}
              >
                {getConfidenceLabel(enrichment.confidence)} Confidence ({Math.round(enrichment.confidence * 100)}%)
              </Badge>
            )}
          </div>

          {/* Field Changes */}
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {fieldChanges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No field changes to review</p>
                </div>
              ) : (
                fieldChanges.map((change, index) => (
                  <div 
                    key={change.field}
                    className="p-3 border rounded-lg space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">
                        {fieldDisplayNames[change.field] || change.field}
                      </span>
                      <Badge variant="secondary" className={getConfidenceColor(change.confidence)}>
                        {Math.round(change.confidence * 100)}%
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <div className="flex-1 p-2 bg-muted/30 rounded text-muted-foreground">
                        {formatValue(change.oldValue)}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      {editMode ? (
                        <Input
                          className="flex-1"
                          defaultValue={formatValue(change.newValue)}
                          onChange={(e) => setEditedValues(prev => ({
                            ...prev,
                            [change.field]: e.target.value,
                          }))}
                        />
                      ) : (
                        <div className="flex-1 p-2 bg-primary/10 rounded text-primary font-medium">
                          {formatValue(change.newValue)}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Feedback Notes (optional)</label>
            <Textarea
              placeholder="Add any notes about this review..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {editMode ? (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setEditMode(false);
                  setEditedValues({});
                }}
              >
                Cancel Edit
              </Button>
              <Button
                onClick={handleSaveEdits}
                disabled={isSubmitting}
              >
                <Check className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isSubmitting}
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditMode(true)}
                disabled={isSubmitting}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                onClick={handleAccept}
                disabled={isSubmitting}
              >
                <Check className="h-4 w-4 mr-2" />
                Accept All
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
