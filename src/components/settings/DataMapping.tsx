import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ArrowRight, 
  Database, 
  Eye,
  Save,
  RotateCcw,
  Wand2,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface FieldMapping {
  id: string;
  sourceField: string;
  targetField: string;
  transformation?: string;
  validation: 'valid' | 'warning' | 'error';
  dataType: 'string' | 'number' | 'date' | 'boolean' | 'email' | 'phone';
  required: boolean;
}

interface Schema {
  name: string;
  fields: { name: string; type: string; description: string; required: boolean }[];
}

const CRM_SCHEMAS: Record<string, Schema> = {
  salesforce: {
    name: 'Salesforce',
    fields: [
      { name: 'Account.Name', type: 'string', description: 'Company name', required: true },
      { name: 'Account.Industry', type: 'string', description: 'Industry classification', required: false },
      { name: 'Account.NumberOfEmployees', type: 'number', description: 'Employee count', required: false },
      { name: 'Account.AnnualRevenue', type: 'number', description: 'Annual revenue', required: false },
      { name: 'Contact.FirstName', type: 'string', description: 'Contact first name', required: true },
      { name: 'Contact.LastName', type: 'string', description: 'Contact last name', required: true },
      { name: 'Contact.Email', type: 'email', description: 'Contact email', required: true },
      { name: 'Contact.Title', type: 'string', description: 'Job title', required: false },
      { name: 'Opportunity.Name', type: 'string', description: 'Opportunity name', required: true },
      { name: 'Opportunity.Stage', type: 'string', description: 'Sales stage', required: true },
      { name: 'Opportunity.Amount', type: 'number', description: 'Deal amount', required: false }
    ]
  },
  hubspot: {
    name: 'HubSpot',
    fields: [
      { name: 'companies.name', type: 'string', description: 'Company name', required: true },
      { name: 'companies.industry', type: 'string', description: 'Industry', required: false },
      { name: 'companies.numberofemployees', type: 'number', description: 'Number of employees', required: false },
      { name: 'companies.annualrevenue', type: 'number', description: 'Annual revenue', required: false },
      { name: 'contacts.firstname', type: 'string', description: 'First name', required: true },
      { name: 'contacts.lastname', type: 'string', description: 'Last name', required: true },
      { name: 'contacts.email', type: 'email', description: 'Email address', required: true },
      { name: 'contacts.jobtitle', type: 'string', description: 'Job title', required: false },
      { name: 'deals.dealname', type: 'string', description: 'Deal name', required: true },
      { name: 'deals.dealstage', type: 'string', description: 'Deal stage', required: true },
      { name: 'deals.amount', type: 'number', description: 'Deal value', required: false }
    ]
  }
};

const SIGNALSCORE_SCHEMA: Schema = {
  name: 'SignalScore',
  fields: [
    { name: 'accounts.name', type: 'string', description: 'Account name', required: true },
    { name: 'accounts.domain', type: 'string', description: 'Company domain', required: false },
    { name: 'accounts.industry_raw', type: 'string', description: 'Raw industry data', required: false },
    { name: 'accounts.industry_norm', type: 'string', description: 'Normalized industry', required: false },
    { name: 'accounts.employee_count', type: 'number', description: 'Number of employees', required: false },
    { name: 'accounts.revenue_range', type: 'string', description: 'Revenue range', required: false },
    { name: 'accounts.country', type: 'string', description: 'Country', required: false },
    { name: 'contacts.first_name', type: 'string', description: 'Contact first name', required: true },
    { name: 'contacts.last_name', type: 'string', description: 'Contact last name', required: true },
    { name: 'contacts.email', type: 'email', description: 'Contact email', required: true },
    { name: 'contacts.title_raw', type: 'string', description: 'Job title', required: false },
    { name: 'contacts.persona', type: 'string', description: 'Persona classification', required: false },
    { name: 'contacts.level', type: 'string', description: 'Seniority level', required: false }
  ]
};

export default function DataMapping() {
  const [selectedCRM, setSelectedCRM] = useState<string>('');
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  const initializeMappings = (crmKey: string) => {
    const crm = CRM_SCHEMAS[crmKey];
    if (!crm) return;

    // Auto-suggest mappings based on field names
    const suggestions: FieldMapping[] = crm.fields.map((field, index) => {
      const targetField = suggestTargetField(field.name);
      return {
        id: `mapping-${index}`,
        sourceField: field.name,
        targetField: targetField || '',
        validation: targetField ? 'valid' : 'warning',
        dataType: field.type as any,
        required: field.required
      };
    });

    setMappings(suggestions);
  };

  const suggestTargetField = (sourceField: string): string => {
    const mapping: Record<string, string> = {
      // Salesforce mappings
      'Account.Name': 'accounts.name',
      'Account.Industry': 'accounts.industry_raw',
      'Account.NumberOfEmployees': 'accounts.employee_count',
      'Account.AnnualRevenue': 'accounts.revenue_range',
      'Contact.FirstName': 'contacts.first_name',
      'Contact.LastName': 'contacts.last_name',
      'Contact.Email': 'contacts.email',
      'Contact.Title': 'contacts.title_raw',
      
      // HubSpot mappings
      'companies.name': 'accounts.name',
      'companies.industry': 'accounts.industry_raw',
      'companies.numberofemployees': 'accounts.employee_count',
      'companies.annualrevenue': 'accounts.revenue_range',
      'contacts.firstname': 'contacts.first_name',
      'contacts.lastname': 'contacts.last_name',
      'contacts.email': 'contacts.email',
      'contacts.jobtitle': 'contacts.title_raw'
    };

    return mapping[sourceField] || '';
  };

  const updateMapping = (id: string, field: keyof FieldMapping, value: any) => {
    setMappings(prev => prev.map(mapping => 
      mapping.id === id 
        ? { 
            ...mapping, 
            [field]: value,
            validation: field === 'targetField' 
              ? (value ? 'valid' : 'warning')
              : mapping.validation
          }
        : mapping
    ));
  };

  const generatePreview = () => {
    const sampleData = [
      {
        'Account.Name': 'Acme Corporation',
        'Account.Industry': 'Technology',
        'Account.NumberOfEmployees': 1500,
        'Contact.FirstName': 'John',
        'Contact.LastName': 'Smith',
        'Contact.Email': 'john.smith@acme.com',
        'Contact.Title': 'VP of Sales'
      },
      {
        'Account.Name': 'TechStart Inc',
        'Account.Industry': 'Software',
        'Account.NumberOfEmployees': 50,
        'Contact.FirstName': 'Sarah',
        'Contact.LastName': 'Johnson',
        'Contact.Email': 'sarah@techstart.com',
        'Contact.Title': 'CEO'
      }
    ];

    const transformedData = sampleData.map(record => {
      const transformed: any = {};
      mappings.forEach(mapping => {
        if (mapping.targetField && mapping.sourceField in record) {
          transformed[mapping.targetField] = record[mapping.sourceField as keyof typeof record];
        }
      });
      return transformed;
    });

    setPreviewData(transformedData);
    setShowPreview(true);
  };

  const saveMappings = () => {
    const validMappings = mappings.filter(m => m.targetField);
    // Here you would save to your backend
    toast({ 
      title: "Success", 
      description: `Saved ${validMappings.length} field mappings for ${CRM_SCHEMAS[selectedCRM]?.name}` 
    });
  };

  const getValidationIcon = (validation: string) => {
    switch (validation) {
      case 'valid': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  if (!selectedCRM) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Data Field Mapping</CardTitle>
            <CardDescription>
              Map fields from your CRM to SignalScore schema for accurate data import
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Select CRM System</label>
                <Select value={selectedCRM} onValueChange={(value) => {
                  setSelectedCRM(value);
                  initializeMappings(value);
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choose your CRM system" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CRM_SCHEMAS).map(([key, schema]) => (
                      <SelectItem key={key} value={key}>
                        {schema.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Field Mapping: {CRM_SCHEMAS[selectedCRM].name} → SignalScore</h3>
          <p className="text-sm text-muted-foreground">Configure how fields are mapped between systems</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setSelectedCRM('')}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Change CRM
          </Button>
          <Button variant="outline" onClick={() => initializeMappings(selectedCRM)}>
            <Wand2 className="h-4 w-4 mr-2" />
            Auto-Suggest
          </Button>
          <Button variant="outline" onClick={generatePreview}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={saveMappings}>
            <Save className="h-4 w-4 mr-2" />
            Save Mappings
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="grid grid-cols-12 gap-4 font-medium text-sm text-muted-foreground border-b pb-2">
              <div className="col-span-4">Source Field ({CRM_SCHEMAS[selectedCRM].name})</div>
              <div className="col-span-1 text-center">→</div>
              <div className="col-span-4">Target Field (SignalScore)</div>
              <div className="col-span-2">Transformation</div>
              <div className="col-span-1">Status</div>
            </div>

            {mappings.map((mapping) => {
              const sourceField = CRM_SCHEMAS[selectedCRM].fields.find(f => f.name === mapping.sourceField);
              const targetField = SIGNALSCORE_SCHEMA.fields.find(f => f.name === mapping.targetField);
              
              return (
                <div key={mapping.id} className="grid grid-cols-12 gap-4 items-center py-3 border-b">
                  <div className="col-span-4">
                    <div className="font-medium">{mapping.sourceField}</div>
                    <div className="text-xs text-muted-foreground">
                      {sourceField?.description} • {sourceField?.type}
                      {sourceField?.required && <Badge variant="outline" className="ml-1 text-xs">Required</Badge>}
                    </div>
                  </div>
                  
                  <div className="col-span-1 flex justify-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  
                  <div className="col-span-4">
                    <Select 
                      value={mapping.targetField} 
                      onValueChange={(value) => updateMapping(mapping.id, 'targetField', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select target field" />
                      </SelectTrigger>
                      <SelectContent>
                        {SIGNALSCORE_SCHEMA.fields.map((field) => (
                          <SelectItem key={field.name} value={field.name}>
                            <div>
                              <div className="font-medium">{field.name}</div>
                              <div className="text-xs text-muted-foreground">{field.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {targetField && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {targetField.description} • {targetField.type}
                      </div>
                    )}
                  </div>
                  
                  <div className="col-span-2">
                    <Select 
                      value={mapping.transformation || 'none'} 
                      onValueChange={(value) => updateMapping(mapping.id, 'transformation', value === 'none' ? undefined : value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No transformation</SelectItem>
                        <SelectItem value="lowercase">Convert to lowercase</SelectItem>
                        <SelectItem value="uppercase">Convert to uppercase</SelectItem>
                        <SelectItem value="trim">Trim whitespace</SelectItem>
                        <SelectItem value="normalize">Normalize text</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="col-span-1 flex justify-center">
                    {getValidationIcon(mapping.validation)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      {showPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Data Transformation Preview</CardTitle>
            <CardDescription>Preview how your data will be transformed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {previewData.map((record, index) => (
                <div key={index} className="p-4 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Record {index + 1}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {Object.entries(record).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium">{key}:</span> {String(value)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <Button variant="outline" onClick={() => setShowPreview(false)}>
                Close Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}