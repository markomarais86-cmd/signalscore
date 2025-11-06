import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight, X, Search, RefreshCw, Grip } from "lucide-react";

interface FieldMapping {
  sourceField: string;
  sourceLabel: string;
  targetField: string;
  targetLabel: string;
  dataType?: string;
}

interface CRMField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}

interface CRMFieldMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  integrationId: string;
  provider: 'salesforce' | 'hubspot';
  orgId: string;
}

const TARGET_SCHEMA_FIELDS = {
  accounts: [
    { name: 'name', label: 'Account Name', type: 'text', required: true },
    { name: 'domain', label: 'Domain', type: 'text', required: false },
    { name: 'industry_raw', label: 'Industry (Raw)', type: 'text', required: false },
    { name: 'industry_norm', label: 'Industry (Normalized)', type: 'text', required: false },
    { name: 'employee_count', label: 'Employee Count', type: 'number', required: false },
    { name: 'revenue_range', label: 'Revenue Range', type: 'text', required: false },
    { name: 'country', label: 'Country', type: 'text', required: false },
    { name: 'state_province', label: 'State/Province', type: 'text', required: false },
    { name: 'phone', label: 'Phone', type: 'text', required: false },
  ],
  contacts: [
    { name: 'first_name', label: 'First Name', type: 'text', required: false },
    { name: 'last_name', label: 'Last Name', type: 'text', required: false },
    { name: 'email', label: 'Email', type: 'text', required: true },
    { name: 'title_raw', label: 'Job Title', type: 'text', required: false },
    { name: 'phone', label: 'Phone', type: 'text', required: false },
    { name: 'mobile', label: 'Mobile', type: 'text', required: false },
  ],
  leads: [
    { name: 'name', label: 'Lead Name', type: 'text', required: false },
    { name: 'email', label: 'Email', type: 'text', required: false },
    { name: 'first_name', label: 'First Name', type: 'text', required: false },
    { name: 'last_name', label: 'Last Name', type: 'text', required: false },
    { name: 'company', label: 'Company', type: 'text', required: false },
    { name: 'title', label: 'Job Title', type: 'text', required: false },
    { name: 'phone', label: 'Phone', type: 'text', required: false },
    { name: 'status', label: 'Status', type: 'text', required: false },
  ]
};

export default function CRMFieldMappingDialog({
  open,
  onOpenChange,
  integrationId,
  provider,
  orgId
}: CRMFieldMappingDialogProps) {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [sourceFields, setSourceFields] = useState<Record<string, CRMField[]>>({
    accounts: [],
    contacts: [],
    leads: []
  });
  const [selectedObject, setSelectedObject] = useState<'accounts' | 'contacts' | 'leads'>('accounts');
  const [searchSource, setSearchSource] = useState('');
  const [searchTarget, setSearchTarget] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedField, setDraggedField] = useState<CRMField | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      loadFieldMappings();
      fetchCRMFields();
    }
  }, [open, integrationId]);

  const loadFieldMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('integration_configs')
        .select('config')
        .eq('id', integrationId)
        .single();

      if (error) throw error;

      const config = data?.config as any;
      if (config?.field_mappings && Array.isArray(config.field_mappings)) {
        setMappings(config.field_mappings);
      }
    } catch (error: any) {
      console.error('Error loading field mappings:', error);
    }
  };

  const fetchCRMFields = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('integration-service', {
        body: {
          action: 'getFields',
          org_id: orgId,
          provider: provider,
          integration_id: integrationId
        }
      });

      if (error) throw error;

      if (data?.fields) {
        setSourceFields(data.fields);
      } else {
        // Mock data if API doesn't return fields yet
        setSourceFields({
          accounts: provider === 'salesforce' ? [
            { name: 'Name', label: 'Account Name', type: 'string', required: true },
            { name: 'Website', label: 'Website', type: 'url' },
            { name: 'Industry', label: 'Industry', type: 'picklist' },
            { name: 'NumberOfEmployees', label: 'Employees', type: 'int' },
            { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency' },
            { name: 'BillingCountry', label: 'Country', type: 'string' },
            { name: 'BillingState', label: 'State', type: 'string' },
            { name: 'Phone', label: 'Phone', type: 'phone' },
            { name: 'Custom_Field__c', label: 'Custom Field', type: 'string' },
          ] : [
            { name: 'name', label: 'Company Name', type: 'string', required: true },
            { name: 'domain', label: 'Domain', type: 'string' },
            { name: 'industry', label: 'Industry', type: 'string' },
            { name: 'numberofemployees', label: 'Number of Employees', type: 'number' },
            { name: 'annualrevenue', label: 'Annual Revenue', type: 'number' },
            { name: 'country', label: 'Country', type: 'string' },
            { name: 'state', label: 'State', type: 'string' },
            { name: 'phone', label: 'Phone Number', type: 'string' },
          ],
          contacts: provider === 'salesforce' ? [
            { name: 'FirstName', label: 'First Name', type: 'string' },
            { name: 'LastName', label: 'Last Name', type: 'string', required: true },
            { name: 'Email', label: 'Email', type: 'email', required: true },
            { name: 'Title', label: 'Title', type: 'string' },
            { name: 'Phone', label: 'Phone', type: 'phone' },
            { name: 'MobilePhone', label: 'Mobile', type: 'phone' },
          ] : [
            { name: 'firstname', label: 'First Name', type: 'string' },
            { name: 'lastname', label: 'Last Name', type: 'string' },
            { name: 'email', label: 'Email', type: 'string', required: true },
            { name: 'jobtitle', label: 'Job Title', type: 'string' },
            { name: 'phone', label: 'Phone', type: 'string' },
            { name: 'mobilephone', label: 'Mobile Phone', type: 'string' },
          ],
          leads: provider === 'salesforce' ? [
            { name: 'FirstName', label: 'First Name', type: 'string' },
            { name: 'LastName', label: 'Last Name', type: 'string', required: true },
            { name: 'Email', label: 'Email', type: 'email' },
            { name: 'Company', label: 'Company', type: 'string', required: true },
            { name: 'Title', label: 'Title', type: 'string' },
            { name: 'Phone', label: 'Phone', type: 'phone' },
            { name: 'Status', label: 'Status', type: 'picklist' },
          ] : []
        });
      }
    } catch (error: any) {
      console.error('Error fetching CRM fields:', error);
      toast({
        title: "Error",
        description: "Failed to fetch CRM fields. Using default mappings.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragStart = (field: CRMField) => {
    setDraggedField(field);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetField: CRMField) => {
    if (draggedField) {
      const existingMappingIndex = mappings.findIndex(
        m => m.targetField === targetField.name && m.sourceField === draggedField.name
      );

      if (existingMappingIndex === -1) {
        const newMapping: FieldMapping = {
          sourceField: draggedField.name,
          sourceLabel: draggedField.label,
          targetField: targetField.name,
          targetLabel: targetField.label,
          dataType: targetField.type
        };

        setMappings([...mappings, newMapping]);
        
        toast({
          title: "Mapping Created",
          description: `${draggedField.label} → ${targetField.label}`
        });
      }

      setDraggedField(null);
    }
  };

  const removeMapping = (sourceField: string, targetField: string) => {
    setMappings(mappings.filter(
      m => !(m.sourceField === sourceField && m.targetField === targetField)
    ));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Get current config
      const { data: currentConfig, error: fetchError } = await supabase
        .from('integration_configs')
        .select('config')
        .eq('id', integrationId)
        .single();

      if (fetchError) throw fetchError;

      // Update with new field mappings
      const existingConfig = (currentConfig?.config as any) || {};
      const updatedConfig = {
        ...existingConfig,
        field_mappings: mappings
      };

      const { error: updateError } = await supabase
        .from('integration_configs')
        .update({ config: updatedConfig as any })
        .eq('id', integrationId);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: `Field mappings saved (${mappings.length} mappings)`
      });

      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving field mappings:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to save field mappings",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredSourceFields = sourceFields[selectedObject]?.filter(field =>
    field.label.toLowerCase().includes(searchSource.toLowerCase()) ||
    field.name.toLowerCase().includes(searchSource.toLowerCase())
  ) || [];

  const filteredTargetFields = TARGET_SCHEMA_FIELDS[selectedObject].filter(field =>
    field.label.toLowerCase().includes(searchTarget.toLowerCase()) ||
    field.name.toLowerCase().includes(searchTarget.toLowerCase())
  );

  const currentObjectMappings = mappings.filter(m => 
    TARGET_SCHEMA_FIELDS[selectedObject].some(f => f.name === m.targetField)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>
            Field Mapping - {provider === 'salesforce' ? 'Salesforce' : 'HubSpot'}
          </DialogTitle>
          <DialogDescription>
            Drag fields from {provider === 'salesforce' ? 'Salesforce' : 'HubSpot'} (left) to your schema (right) to create mappings.
            These mappings will be used during data sync.
          </DialogDescription>
        </DialogHeader>

        {/* Object Type Selector */}
        <div className="flex gap-2 border-b pb-4">
          {(['accounts', 'contacts', 'leads'] as const).map((obj) => (
            <Button
              key={obj}
              variant={selectedObject === obj ? 'default' : 'outline'}
              onClick={() => setSelectedObject(obj)}
              size="sm"
            >
              {obj.charAt(0).toUpperCase() + obj.slice(1)}
              {mappings.filter(m => 
                TARGET_SCHEMA_FIELDS[obj].some(f => f.name === m.targetField)
              ).length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {mappings.filter(m => 
                    TARGET_SCHEMA_FIELDS[obj].some(f => f.name === m.targetField)
                  ).length}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Source Fields (CRM) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">
                {provider === 'salesforce' ? 'Salesforce' : 'HubSpot'} Fields
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchCRMFields}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search source fields..."
                value={searchSource}
                onChange={(e) => setSearchSource(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="p-4 space-y-2">
                {filteredSourceFields.map((field) => (
                  <Card
                    key={field.name}
                    draggable
                    onDragStart={() => handleDragStart(field)}
                    className="p-3 cursor-move hover:bg-accent transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Grip className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{field.label}</span>
                          {field.required && (
                            <Badge variant="destructive" className="text-xs">Required</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{field.name}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">{field.type}</Badge>
                    </div>
                  </Card>
                ))}
                {filteredSourceFields.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No fields found
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Target Fields (Our Schema) */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Your Schema</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search target fields..."
                value={searchTarget}
                onChange={(e) => setSearchTarget(e.target.value)}
                className="pl-9"
              />
            </div>
            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="p-4 space-y-2">
                {filteredTargetFields.map((field) => {
                  const fieldMappings = currentObjectMappings.filter(m => m.targetField === field.name);
                  
                  return (
                    <Card
                      key={field.name}
                      onDragOver={handleDragOver}
                      onDrop={() => handleDrop(field)}
                      className={`p-3 transition-colors ${
                        fieldMappings.length > 0 ? 'bg-primary/5 border-primary/20' : ''
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{field.label}</span>
                              {field.required && (
                                <Badge variant="destructive" className="text-xs">Required</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{field.name}</p>
                          </div>
                          <Badge variant="outline" className="text-xs">{field.type}</Badge>
                        </div>
                        
                        {fieldMappings.length > 0 && (
                          <div className="space-y-1">
                            {fieldMappings.map((mapping, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 bg-background p-2 rounded text-xs"
                              >
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className="flex-1">{mapping.sourceLabel}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeMapping(mapping.sourceField, mapping.targetField)}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {mappings.length} total mapping{mappings.length !== 1 ? 's' : ''} configured
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Mappings'}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
