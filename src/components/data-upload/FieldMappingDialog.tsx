import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, AlertTriangle, ArrowRight, Sparkles, Database } from "lucide-react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SYSTEM_FIELDS, autoDetectMapping } from "./fieldMappingConstants";
import { useDataOrgId } from "@/hooks/use-data-org";

export interface FieldMapping {
  [csvColumn: string]: string;
}

interface FieldMappingData {
  csvColumn: string;
  systemField: string;
  confidence: number;
  required: boolean;
}

interface CustomAttributeDefinition {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  category: string | null;
}

interface FieldMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mappings: FieldMapping) => void;
  csvHeaders: string[];
  dataType: 'accounts' | 'contacts' | 'leads' | 'combined';
  sampleData?: any[];
  orgId?: string;
}

export function FieldMappingDialog({ isOpen, onClose, onConfirm, csvHeaders, dataType, sampleData, orgId: propOrgId }: FieldMappingDialogProps) {
  const { dataOrgId } = useDataOrgId();
  const orgId = propOrgId || dataOrgId;
  const [mappings, setMappings] = useState<FieldMapping>({});
  const [autoDetected, setAutoDetected] = useState<FieldMappingData[]>([]);
  const systemFields = SYSTEM_FIELDS[dataType];

  // Fetch custom attribute definitions for the org
  const { data: customDefs = [] } = useQuery<CustomAttributeDefinition[]>({
    queryKey: ['custom-attribute-definitions', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('custom_attribute_definitions')
        .select('id, field_key, field_label, field_type, category')
        .eq('org_id', orgId);
      if (error) throw error;
      return (data || []) as CustomAttributeDefinition[];
    },
    enabled: !!orgId && isOpen,
  });

  useEffect(() => {
    if (isOpen && csvHeaders.length > 0) {
      const detected: FieldMappingData[] = [];
      const initialMappings: FieldMapping = {};

      csvHeaders.forEach(csvCol => {
        const match = autoDetectMapping(csvCol, systemFields);
        if (match && match.confidence >= 70) {
          const systemField = systemFields.find(f => f.value === match.field);
          detected.push({
            csvColumn: csvCol,
            systemField: match.field,
            confidence: match.confidence,
            required: systemField?.required || false,
          });
          initialMappings[csvCol] = match.field;
        }
      });

      setAutoDetected(detected);
      setMappings(initialMappings);
    }
  }, [isOpen, csvHeaders, dataType]);

  const handleMappingChange = (csvColumn: string, systemField: string) => {
    setMappings(prev => ({
      ...prev,
      [csvColumn]: systemField,
    }));
  };

  const getMappedFields = () => {
    return new Set(Object.values(mappings));
  };

  const getUnmappedRequired = () => {
    const mapped = getMappedFields();
    return systemFields.filter(f => f.required && !mapped.has(f.value));
  };

  const getUnmappedColumns = () => {
    return csvHeaders.filter(col => !mappings[col] || mappings[col] === '__skip__');
  };

  const handleBulkMapCustom = () => {
    const unmapped = getUnmappedColumns();
    const newMappings = { ...mappings };
    unmapped.forEach(col => {
      const key = col.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      // Check if there's a matching custom definition
      const matchingDef = customDefs.find(d => 
        d.field_key === key || d.field_label.toLowerCase() === col.toLowerCase()
      );
      newMappings[col] = matchingDef ? `custom::${matchingDef.field_key}` : `custom::${key}`;
    });
    setMappings(newMappings);
  };

  const canConfirm = getUnmappedRequired().length === 0;

  const getConfidenceBadge = (csvCol: string) => {
    const currentMapping = mappings[csvCol];
    if (currentMapping?.startsWith('custom::')) {
      return <Badge className="bg-[hsl(var(--accent))] text-accent-foreground">Custom</Badge>;
    }
    const autoDetection = autoDetected.find(d => d.csvColumn === csvCol);
    if (!autoDetection) return null;
    if (autoDetection.confidence >= 90) return <Badge className="bg-[hsl(var(--signal-high))]">High Match</Badge>;
    if (autoDetection.confidence >= 70) return <Badge className="bg-[hsl(var(--signal-medium))]">Good Match</Badge>;
    return <Badge variant="secondary">Low Match</Badge>;
  };

  const unmappedCount = getUnmappedColumns().length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Smart Field Mapping
          </DialogTitle>
          <DialogDescription>
            We've automatically detected field matches. Review and adjust as needed.
          </DialogDescription>
        </DialogHeader>

        {autoDetected.length > 0 && (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Automatically mapped {autoDetected.length} of {csvHeaders.length} columns
            </AlertDescription>
          </Alert>
        )}

        {unmappedCount > 0 && (
          <Alert>
            <Database className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{unmappedCount} column{unmappedCount !== 1 ? 's are' : ' is'} unmapped. Map as custom attributes?</span>
              <Button size="sm" variant="secondary" onClick={handleBulkMapCustom} className="ml-2 shrink-0">
                <Database className="h-3 w-3 mr-1" />
                Map all as custom
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="space-y-3">
            {csvHeaders.map(csvCol => {
              const currentMapping = mappings[csvCol];

              return (
                <div key={csvCol} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{csvCol}</div>
                    <div className="flex items-center gap-2 mt-1">
                      {getConfidenceBadge(csvCol)}
                    </div>
                  </div>

                  <ArrowRight className="h-4 w-4 text-muted-foreground" />

                  <div className="flex-1">
                    <Select
                      value={currentMapping || ""}
                      onValueChange={(value) => handleMappingChange(csvCol, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">Skip this column</SelectItem>
                        {systemFields.map(field => (
                          <SelectItem key={field.value} value={field.value}>
                            {field.label} {field.required && '*'}
                          </SelectItem>
                        ))}

                        {/* Custom attribute options */}
                        {(customDefs.length > 0 || true) && (
                          <>
                            <Separator className="my-1" />
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Custom Attributes</div>
                            {customDefs.map(def => (
                              <SelectItem key={`custom::${def.field_key}`} value={`custom::${def.field_key}`}>
                                Custom: {def.field_label}
                              </SelectItem>
                            ))}
                            {(() => {
                              const key = csvCol.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
                              const alreadyDefined = customDefs.some(d => d.field_key === key);
                              if (!alreadyDefined) {
                                return (
                                  <SelectItem value={`custom::${key}`}>
                                    Custom: {csvCol} (new)
                                  </SelectItem>
                                );
                              }
                              return null;
                            })()}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
          </div>

          {getUnmappedRequired().length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Required fields not mapped: {getUnmappedRequired().map(f => f.label).join(', ')}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(mappings)} disabled={!canConfirm}>
            Confirm Mapping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
