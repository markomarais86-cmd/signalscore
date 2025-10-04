import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";

export interface FieldMapping {
  [csvColumn: string]: string;
}

interface FieldMappingData {
  csvColumn: string;
  systemField: string;
  confidence: number;
  required: boolean;
}

interface FieldMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mappings: FieldMapping) => void;
  csvHeaders: string[];
  dataType: 'accounts' | 'contacts' | 'leads' | 'combined';
  sampleData?: any[];
}

const SYSTEM_FIELDS = {
  accounts: [
    { value: 'external_id', label: 'Account ID', required: true },
    { value: 'name', label: 'Company Name', required: true },
    { value: 'domain', label: 'Website/Domain', required: false },
    { value: 'industry_raw', label: 'Industry', required: false },
    { value: 'employee_count', label: 'Employee Count', required: false },
    { value: 'revenue_range', label: 'Revenue Range', required: false },
    { value: 'country', label: 'Country', required: false },
    { value: 'phone', label: 'Phone', required: false },
    { value: 'mobile', label: 'Mobile', required: false },
    { value: 'state_province', label: 'State/Province', required: false },
  ],
  contacts: [
    { value: 'external_id', label: 'Contact ID', required: true },
    { value: 'account_external_id', label: 'Account ID', required: true },
    { value: 'first_name', label: 'First Name', required: true },
    { value: 'last_name', label: 'Last Name', required: true },
    { value: 'email', label: 'Email', required: false },
    { value: 'title_raw', label: 'Job Title', required: false },
    { value: 'country', label: 'Country', required: false },
    { value: 'phone', label: 'Phone', required: false },
    { value: 'mobile', label: 'Mobile', required: false },
    { value: 'state_province', label: 'State/Province', required: false },
  ],
  leads: [
    { value: 'external_id', label: 'Lead ID', required: true },
    { value: 'first_name', label: 'First Name', required: false },
    { value: 'last_name', label: 'Last Name', required: false },
    { value: 'email', label: 'Email', required: false },
    { value: 'phone', label: 'Phone', required: false },
    { value: 'mobile', label: 'Mobile', required: false },
    { value: 'title', label: 'Title', required: false },
    { value: 'company', label: 'Company', required: false },
    { value: 'website', label: 'Website', required: false },
    { value: 'industry', label: 'Industry', required: false },
    { value: 'revenue_range', label: 'Annual Revenue', required: false },
    { value: 'employee_count', label: 'Number of Employees', required: false },
    { value: 'country', label: 'Country', required: false },
    { value: 'state_province', label: 'State/Province', required: false },
    { value: 'status', label: 'Status', required: false },
  ],
  combined: [
    { value: 'external_id', label: 'ID', required: true },
    { value: 'first_name', label: 'First Name', required: false },
    { value: 'last_name', label: 'Last Name', required: false },
    { value: 'email', label: 'Email', required: false },
    { value: 'phone', label: 'Phone', required: false },
    { value: 'mobile', label: 'Mobile', required: false },
    { value: 'title', label: 'Title', required: false },
    { value: 'company', label: 'Company', required: false },
    { value: 'website', label: 'Website', required: false },
    { value: 'industry', label: 'Industry', required: false },
    { value: 'revenue_range', label: 'Annual Revenue', required: false },
    { value: 'employee_count', label: 'Number of Employees', required: false },
    { value: 'country', label: 'Country', required: false },
    { value: 'state_province', label: 'State/Province', required: false },
  ],
};

// Smart mapping algorithm
const autoDetectMapping = (csvColumn: string, systemFields: typeof SYSTEM_FIELDS.accounts): { field: string; confidence: number } | null => {
  const normalized = csvColumn.toLowerCase().trim();
  
  const patterns: Record<string, string[]> = {
    external_id: ['lead id', 'id', 'external_id', 'account_id', 'company_id', 'contact_id', 'lead_id', 'crm_id', 'salesforce_id'],
    account_external_id: ['account_id', 'company_id', 'account', 'company'],
    name: ['name', 'company_name', 'company', 'account_name', 'organization'],
    first_name: ['first name', 'first_name', 'firstname', 'fname', 'given_name'],
    last_name: ['last name', 'last_name', 'lastname', 'lname', 'surname', 'family_name'],
    email: ['email', 'email_address', 'mail', 'e-mail'],
    domain: ['domain', 'website', 'url', 'web', 'site'],
    website: ['website', 'domain', 'url', 'web', 'site'],
    industry_raw: ['industry', 'sector', 'vertical', 'business_type'],
    industry: ['industry', 'sector', 'vertical', 'business_type'],
    employee_count: ['no. of employees', 'number of employees', 'employee range', 'employee_count', 'employees', 'headcount', 'size', 'company_size'],
    revenue_range: ['annual revenue', 'revenue band', 'revenue', 'revenue_range', 'annual_revenue', 'arr', 'sales'],
    country: ['country', 'nation', 'location'],
    state_province: ['state/province', 'state', 'province', 'region'],
    title_raw: ['title', 'job_title', 'position', 'role', 'job_position'],
    title: ['title', 'job_title', 'position', 'role', 'job_position'],
    phone: ['phone', 'telephone', 'tel', 'phone number', 'work phone'],
    mobile: ['mobile', 'cell', 'cell phone', 'mobile number', 'cellular'],
    company: ['company', 'company_name', 'company name', 'organization', 'account_name'],
    status: ['status', 'lead_status', 'stage', 'lead status'],
  };

  let bestMatch: { field: string; confidence: number } | null = null;

  for (const field of systemFields) {
    const fieldPatterns = patterns[field.value] || [];
    
    // Exact match
    if (fieldPatterns.includes(normalized)) {
      return { field: field.value, confidence: 100 };
    }

    // Partial match
    for (const pattern of fieldPatterns) {
      if (normalized.includes(pattern) || pattern.includes(normalized)) {
        const confidence = Math.round((pattern.length / Math.max(normalized.length, pattern.length)) * 90);
        if (!bestMatch || confidence > bestMatch.confidence) {
          bestMatch = { field: field.value, confidence };
        }
      }
    }
  }

  return bestMatch;
};

export function FieldMappingDialog({ isOpen, onClose, onConfirm, csvHeaders, dataType, sampleData }: FieldMappingDialogProps) {
  const [mappings, setMappings] = useState<FieldMapping>({});
  const [autoDetected, setAutoDetected] = useState<FieldMappingData[]>([]);
  const systemFields = SYSTEM_FIELDS[dataType];

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

  const canConfirm = getUnmappedRequired().length === 0;

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) return <Badge className="bg-[hsl(var(--signal-high))]">High Match</Badge>;
    if (confidence >= 70) return <Badge className="bg-[hsl(var(--signal-medium))]">Good Match</Badge>;
    return <Badge variant="secondary">Low Match</Badge>;
  };

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

        <div className="space-y-4">
          <div className="space-y-3">
            {csvHeaders.map(csvCol => {
              const currentMapping = mappings[csvCol];
              const autoDetection = autoDetected.find(d => d.csvColumn === csvCol);

              return (
                <div key={csvCol} className="flex items-center gap-4 p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-sm">{csvCol}</div>
                    {autoDetection && (
                      <div className="flex items-center gap-2 mt-1">
                        {getConfidenceBadge(autoDetection.confidence)}
                      </div>
                    )}
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
