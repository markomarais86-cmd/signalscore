import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertTriangle, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface FieldMappingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mapping: FieldMapping) => void;
  csvHeaders: string[];
  dataType: 'accounts' | 'contacts';
  sampleData?: any[];
}

export interface FieldMapping {
  [csvHeader: string]: string | null; // Maps CSV header to our schema field
}

const SCHEMA_FIELDS = {
  accounts: [
    { key: 'external_id', label: 'External ID', required: true, description: 'Unique identifier (required)' },
    { key: 'name', label: 'Company Name', required: false, description: 'Company or account name' },
    { key: 'domain', label: 'Website Domain', required: false, description: 'Company website (e.g., company.com)' },
    { key: 'industry_raw', label: 'Industry', required: false, description: 'Industry or vertical' },
    { key: 'employee_count', label: 'Employee Count', required: false, description: 'Number of employees (numeric)' },
    { key: 'revenue_range', label: 'Revenue Range', required: false, description: 'Annual revenue range' },
    { key: 'country', label: 'Country', required: false, description: 'Primary location/country' },
  ],
  contacts: [
    { key: 'external_id', label: 'External ID', required: true, description: 'Unique contact identifier (required)' },
    { key: 'account_external_id', label: 'Account ID', required: true, description: 'Link to account (required)' },
    { key: 'first_name', label: 'First Name', required: false, description: 'Contact first name' },
    { key: 'last_name', label: 'Last Name', required: false, description: 'Contact last name' },
    { key: 'email', label: 'Email', required: false, description: 'Contact email address' },
    { key: 'title_raw', label: 'Job Title', required: false, description: 'Job title or position' },
    { key: 'country', label: 'Country', required: false, description: 'Contact location' },
  ]
};

export function FieldMappingDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  csvHeaders, 
  dataType, 
  sampleData 
}: FieldMappingDialogProps) {
  const [mapping, setMapping] = useState<FieldMapping>({});
  const [autoMapped, setAutoMapped] = useState<string[]>([]);

  const schemaFields = SCHEMA_FIELDS[dataType];

  useEffect(() => {
    if (isOpen && csvHeaders.length > 0) {
      autoMapFields();
    }
  }, [isOpen, csvHeaders]);

  const autoMapFields = () => {
    const newMapping: FieldMapping = {};
    const mapped: string[] = [];

    // Auto-mapping logic based on common field names
    csvHeaders.forEach(csvHeader => {
      const cleanHeader = csvHeader.toLowerCase().trim();
      
      // Find matching schema field
      const matchedField = schemaFields.find(field => {
        const fieldAliases = getFieldAliases(field.key);
        return fieldAliases.some(alias => 
          cleanHeader.includes(alias) || alias.includes(cleanHeader)
        );
      });

      if (matchedField) {
        newMapping[csvHeader] = matchedField.key;
        mapped.push(csvHeader);
      } else {
        newMapping[csvHeader] = null;
      }
    });

    setMapping(newMapping);
    setAutoMapped(mapped);
  };

  const getFieldAliases = (fieldKey: string): string[] => {
    const aliases: { [key: string]: string[] } = {
      external_id: ['id', 'external_id', 'account_id', 'contact_id', 'unique_id'],
      name: ['name', 'company', 'company_name', 'account_name', 'organization'],
      domain: ['domain', 'website', 'url', 'web', 'site'],
      industry_raw: ['industry', 'vertical', 'sector', 'business_type'],
      employee_count: ['employees', 'employee_count', 'headcount', 'size', 'team_size'],
      revenue_range: ['revenue', 'annual_revenue', 'arr', 'turnover', 'sales'],
      country: ['country', 'location', 'region', 'nation'],
      account_external_id: ['account_id', 'company_id', 'account_external_id', 'parent_id'],
      first_name: ['first_name', 'firstname', 'fname', 'given_name'],
      last_name: ['last_name', 'lastname', 'lname', 'surname', 'family_name'],
      email: ['email', 'email_address', 'contact_email', 'work_email'],
      title_raw: ['title', 'job_title', 'position', 'role', 'designation'],
    };
    
    return aliases[fieldKey] || [fieldKey];
  };

  const getValidationStatus = () => {
    const requiredFields = schemaFields.filter(field => field.required);
    const mappedRequiredFields = requiredFields.filter(field => 
      Object.values(mapping).includes(field.key)
    );
    
    return {
      isValid: mappedRequiredFields.length === requiredFields.length,
      missingRequired: requiredFields.filter(field => 
        !Object.values(mapping).includes(field.key)
      ),
      totalMapped: Object.values(mapping).filter(value => value !== null).length,
      totalFields: csvHeaders.length
    };
  };

  const handleMappingChange = (csvHeader: string, schemaField: string | null) => {
    setMapping(prev => ({
      ...prev,
      [csvHeader]: schemaField
    }));
  };

  const handleConfirm = () => {
    const validation = getValidationStatus();
    if (validation.isValid) {
      onConfirm(mapping);
    }
  };

  const validation = getValidationStatus();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Map CSV Fields to SignalScore Schema</DialogTitle>
          <DialogDescription>
            Map your CSV columns to SignalScore fields. Required fields must be mapped to proceed.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Validation Status */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Mapping Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {validation.isValid ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  )}
                  <span className="text-sm">
                    {validation.totalMapped} of {validation.totalFields} fields mapped
                  </span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{autoMapped.length} auto-mapped</Badge>
                  {validation.missingRequired.length > 0 && (
                    <Badge variant="destructive">{validation.missingRequired.length} required missing</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Missing Required Fields Alert */}
          {validation.missingRequired.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Required fields not mapped:</strong>{' '}
                {validation.missingRequired.map(field => field.label).join(', ')}
              </AlertDescription>
            </Alert>
          )}

          {/* Field Mapping Grid */}
          <div className="grid gap-3">
            <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground border-b pb-2">
              <div className="col-span-5">Your CSV Column</div>
              <div className="col-span-1 text-center">→</div>
              <div className="col-span-5">SignalScore Field</div>
              <div className="col-span-1">Sample</div>
            </div>
            
            {csvHeaders.map((csvHeader, index) => {
              const currentMapping = mapping[csvHeader];
              const isAutoMapped = autoMapped.includes(csvHeader);
              const sampleValue = sampleData?.[0]?.[csvHeader];
              
              return (
                <div key={csvHeader} className="grid grid-cols-12 gap-2 items-center py-2 border rounded-lg px-3">
                  <div className="col-span-5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{csvHeader}</span>
                      {isAutoMapped && (
                        <Badge variant="secondary" className="text-xs">auto-mapped</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="col-span-1 text-center">
                    <ArrowRight className="h-3 w-3 text-muted-foreground mx-auto" />
                  </div>
                  
                  <div className="col-span-5">
                    <Select
                      value={currentMapping || ""}
                      onValueChange={(value) => handleMappingChange(csvHeader, value === "none" ? null : value)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Select field..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">Don't map</span>
                        </SelectItem>
                        {schemaFields.map(field => (
                          <SelectItem key={field.key} value={field.key}>
                            <div className="flex items-center gap-2">
                              <span>{field.label}</span>
                              {field.required && (
                                <Badge variant="destructive" className="text-xs">Required</Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="col-span-1">
                    {sampleValue && (
                      <div className="text-xs text-muted-foreground truncate max-w-16" title={sampleValue}>
                        {String(sampleValue).substring(0, 10)}
                        {String(sampleValue).length > 10 && '...'}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Schema Field Guide */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Field Descriptions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-3 text-sm">
                {schemaFields.map(field => (
                  <div key={field.key} className="flex justify-between items-start">
                    <div>
                      <span className="font-medium">{field.label}</span>
                      {field.required && (
                        <Badge variant="destructive" className="text-xs ml-1">Required</Badge>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">{field.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleConfirm}
            disabled={!validation.isValid}
          >
            Import with Mapping ({validation.totalMapped} fields)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}