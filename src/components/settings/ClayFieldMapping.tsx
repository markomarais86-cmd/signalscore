import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface FieldMapping {
  [clayField: string]: string;
}

const DEFAULT_COMPANY_MAPPINGS: FieldMapping = {
  company_name: 'name',
  domain: 'domain',
  industry: 'industry_raw',
  employee_count: 'employee_count',
  revenue: 'revenue_range',
  location: 'country',
  technologies: 'tech_stack',
  funding_round: 'last_funding_round',
  total_funding: 'total_raised_usd'
};

const DEFAULT_CONTACT_MAPPINGS: FieldMapping = {
  email: 'email',
  first_name: 'first_name',
  last_name: 'last_name',
  title: 'title',
  company_domain: 'company',
  linkedin_url: 'linkedin_url',
  phone: 'phone',
  location: 'country'
};

const ACCOUNT_FIELDS = [
  { value: 'name', label: 'Company Name' },
  { value: 'domain', label: 'Domain' },
  { value: 'industry_raw', label: 'Industry' },
  { value: 'employee_count', label: 'Employee Count' },
  { value: 'revenue_range', label: 'Revenue Range' },
  { value: 'country', label: 'Country' },
  { value: 'tech_stack', label: 'Technologies' },
  { value: 'last_funding_round', label: 'Last Funding Round' },
  { value: 'total_raised_usd', label: 'Total Funding' }
];

const LEAD_FIELDS = [
  { value: 'email', label: 'Email' },
  { value: 'first_name', label: 'First Name' },
  { value: 'last_name', label: 'Last Name' },
  { value: 'title', label: 'Job Title' },
  { value: 'company', label: 'Company' },
  { value: 'linkedin_url', label: 'LinkedIn URL' },
  { value: 'phone', label: 'Phone' },
  { value: 'country', label: 'Country' }
];

export function ClayFieldMapping() {
  const [dataType, setDataType] = useState<'company' | 'contact'>('company');
  const [mappings, setMappings] = useState<FieldMapping>(DEFAULT_COMPANY_MAPPINGS);
  const [customClayField, setCustomClayField] = useState('');
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadMappings();
  }, [userProfile?.org_id, dataType]);

  const loadMappings = async () => {
    if (!userProfile?.org_id) return;

    const webhookType = dataType === 'company' ? 'clay_company_data' : 'clay_contact_data';
    
    const { data, error } = await supabase
      .from('clay_webhook_config')
      .select('field_mappings')
      .eq('org_id', userProfile.org_id)
      .eq('webhook_type', webhookType)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading mappings:', error);
      return;
    }

    if (data?.field_mappings && typeof data.field_mappings === 'object') {
      setMappings(data.field_mappings as FieldMapping);
    } else {
      setMappings(dataType === 'company' ? DEFAULT_COMPANY_MAPPINGS : DEFAULT_CONTACT_MAPPINGS);
    }
  };

  const handleSave = async () => {
    if (!userProfile?.org_id) return;

    const webhookType = dataType === 'company' ? 'clay_company_data' : 'clay_contact_data';

    const { error } = await supabase
      .from('clay_webhook_config')
      .upsert({
        org_id: userProfile.org_id,
        webhook_type: webhookType,
        field_mappings: mappings,
        is_enabled: true
      }, {
        onConflict: 'org_id,webhook_type'
      });

    if (error) {
      console.error('Error saving mappings:', error);
      toast({
        title: "Error",
        description: "Failed to save field mappings",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Success",
      description: "Field mappings saved successfully"
    });
  };

  const handleReset = () => {
    const defaults = dataType === 'company' ? DEFAULT_COMPANY_MAPPINGS : DEFAULT_CONTACT_MAPPINGS;
    setMappings(defaults);
  };

  const handleAddCustomMapping = () => {
    if (!customClayField) return;
    setMappings({ ...mappings, [customClayField]: '' });
    setCustomClayField('');
  };

  const handleUpdateMapping = (clayField: string, dbField: string) => {
    setMappings({ ...mappings, [clayField]: dbField });
  };

  const handleRemoveMapping = (clayField: string) => {
    const newMappings = { ...mappings };
    delete newMappings[clayField];
    setMappings(newMappings);
  };

  const targetFields = dataType === 'company' ? ACCOUNT_FIELDS : LEAD_FIELDS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clay Field Mapping</CardTitle>
        <CardDescription>
          Map Clay data fields to your database schema
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Data Type</Label>
          <Select value={dataType} onValueChange={(v) => setDataType(v as 'company' | 'contact')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="company">Company Data</SelectItem>
              <SelectItem value="contact">Contact Data</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="border rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 font-medium text-sm text-muted-foreground">
            <div>Clay Field</div>
            <div>Your Database Field</div>
          </div>

          {Object.entries(mappings).map(([clayField, dbField]) => (
            <div key={clayField} className="grid grid-cols-2 gap-4 items-center">
              <Input value={clayField} disabled className="bg-muted" />
              <div className="flex gap-2">
                <Select 
                  value={dbField} 
                  onValueChange={(value) => handleUpdateMapping(clayField, value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select field" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetFields.map(field => (
                      <SelectItem key={field.value} value={field.value}>
                        {field.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveMapping(clayField)}
                >
                  ×
                </Button>
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4 items-center pt-4 border-t">
            <Input
              placeholder="Add custom Clay field..."
              value={customClayField}
              onChange={(e) => setCustomClayField(e.target.value)}
            />
            <Button onClick={handleAddCustomMapping} variant="outline">
              Add Mapping
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            Save Mappings
          </Button>
          <Button onClick={handleReset} variant="outline">
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
