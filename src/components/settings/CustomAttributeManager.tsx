import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Plus, Trash2, Edit, Sparkles, Building2, Cpu, Factory, ShoppingBag, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useEffectiveOrg } from '@/hooks/use-effective-org';
import { supabase } from '@/integrations/supabase/client';

interface CustomAttributeDefinition {
  id: string;
  org_id: string;
  field_key: string;
  field_label: string;
  field_type: 'number' | 'text' | 'select' | 'multi_select';
  options: string[];
  category: string;
  enrichment_prompt: string | null;
  created_at: string;
}

interface TemplateDefinition {
  name: string;
  icon: React.ReactNode;
  category: string;
  fields: Omit<CustomAttributeDefinition, 'id' | 'org_id' | 'created_at'>[];
}

const INDUSTRY_TEMPLATES: TemplateDefinition[] = [
  {
    name: 'Healthcare',
    icon: <Building2 className="h-4 w-4" />,
    category: 'Healthcare',
    fields: [
      { field_key: 'facility_type', field_label: 'Facility Type', field_type: 'select', options: ['Academic Medical Center', 'Community Hospital', 'Regional Health System', 'Specialty Hospital', 'Critical Access Hospital', 'Teaching Hospital', 'Veterans Hospital'], category: 'Healthcare', enrichment_prompt: 'What type of healthcare facility is this organization? Is it an Academic Medical Center, Community Hospital, Regional Health System, Specialty Hospital, Critical Access Hospital, Teaching Hospital, or Veterans Hospital?' },
      { field_key: 'bed_count', field_label: 'Number of Beds', field_type: 'number', options: [], category: 'Healthcare', enrichment_prompt: 'How many licensed hospital beds does this healthcare facility have? Return a specific number.' },
      { field_key: 'ehr_system', field_label: 'EHR System', field_type: 'select', options: ['Epic', 'Cerner (Oracle Health)', 'Meditech', 'Allscripts', 'athenahealth', 'eClinicalWorks', 'NextGen', 'Other'], category: 'Healthcare', enrichment_prompt: 'What Electronic Health Record (EHR) system does this healthcare organization use? Options include Epic, Cerner/Oracle Health, Meditech, Allscripts, athenahealth, eClinicalWorks, NextGen.' },
      { field_key: 'specialties', field_label: 'Medical Specialties', field_type: 'multi_select', options: ['Cardiology', 'Oncology', 'Orthopedics', 'Neurology', 'Pediatrics', 'Emergency Medicine', 'Surgery', 'Radiology', 'Internal Medicine', 'Psychiatry'], category: 'Healthcare', enrichment_prompt: 'What are the primary medical specialties offered at this healthcare facility?' },
      { field_key: 'cms_star_rating', field_label: 'CMS Star Rating', field_type: 'number', options: [], category: 'Healthcare', enrichment_prompt: 'What is this hospital\'s CMS Overall Hospital Quality Star Rating (1-5 stars)?' },
    ],
  },
  {
    name: 'SaaS / Technology',
    icon: <Cpu className="h-4 w-4" />,
    category: 'SaaS',
    fields: [
      { field_key: 'pricing_model', field_label: 'Pricing Model', field_type: 'select', options: ['Freemium', 'Usage-based', 'Per-seat', 'Tiered', 'Enterprise-only', 'Flat-rate'], category: 'SaaS', enrichment_prompt: 'What pricing model does this SaaS company use? Is it Freemium, Usage-based, Per-seat, Tiered, Enterprise-only, or Flat-rate?' },
      { field_key: 'monthly_active_users', field_label: 'Monthly Active Users', field_type: 'number', options: [], category: 'SaaS', enrichment_prompt: 'Approximately how many monthly active users does this SaaS product have?' },
      { field_key: 'platform_type', field_label: 'Platform Type', field_type: 'select', options: ['Cloud-native', 'Hybrid', 'On-premise', 'Mobile-first', 'API-first'], category: 'SaaS', enrichment_prompt: 'What type of platform is this? Is it Cloud-native, Hybrid, On-premise, Mobile-first, or API-first?' },
      { field_key: 'integration_count', field_label: 'Number of Integrations', field_type: 'number', options: [], category: 'SaaS', enrichment_prompt: 'How many third-party integrations does this SaaS product offer?' },
    ],
  },
  {
    name: 'Manufacturing',
    icon: <Factory className="h-4 w-4" />,
    category: 'Manufacturing',
    fields: [
      { field_key: 'plant_count', field_label: 'Number of Plants', field_type: 'number', options: [], category: 'Manufacturing', enrichment_prompt: 'How many manufacturing plants or facilities does this company operate?' },
      { field_key: 'iso_certifications', field_label: 'ISO Certifications', field_type: 'multi_select', options: ['ISO 9001', 'ISO 14001', 'ISO 45001', 'ISO 13485', 'AS9100', 'IATF 16949'], category: 'Manufacturing', enrichment_prompt: 'What ISO or industry certifications does this manufacturer hold?' },
      { field_key: 'production_type', field_label: 'Production Type', field_type: 'select', options: ['Discrete', 'Process', 'Mixed-mode', 'Job shop', 'Continuous flow', 'Batch'], category: 'Manufacturing', enrichment_prompt: 'What type of manufacturing production does this company use? Is it Discrete, Process, Mixed-mode, Job shop, Continuous flow, or Batch?' },
    ],
  },
  {
    name: 'Retail & E-commerce',
    icon: <ShoppingBag className="h-4 w-4" />,
    category: 'Retail',
    fields: [
      { field_key: 'store_count', field_label: 'Number of Stores', field_type: 'number', options: [], category: 'Retail', enrichment_prompt: 'How many physical retail store locations does this company operate?' },
      { field_key: 'ecommerce_platform', field_label: 'E-commerce Platform', field_type: 'select', options: ['Shopify', 'Magento', 'WooCommerce', 'BigCommerce', 'Salesforce Commerce Cloud', 'Custom'], category: 'Retail', enrichment_prompt: 'What e-commerce platform does this retailer use for their online store?' },
      { field_key: 'distribution_channels', field_label: 'Distribution Channels', field_type: 'multi_select', options: ['Direct-to-consumer', 'Wholesale', 'Marketplace (Amazon)', 'Brick-and-mortar', 'Franchise'], category: 'Retail', enrichment_prompt: 'What distribution channels does this retailer use?' },
    ],
  },
];

export function CustomAttributeManager() {
  const [definitions, setDefinitions] = useState<CustomAttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDef, setEditingDef] = useState<CustomAttributeDefinition | null>(null);
  const [formData, setFormData] = useState({
    field_key: '',
    field_label: '',
    field_type: 'text' as 'number' | 'text' | 'select' | 'multi_select',
    options: '',
    category: 'General',
    enrichment_prompt: '',
  });

  const { toast } = useToast();
  const { effectiveOrgId } = useEffectiveOrg();

  useEffect(() => {
    if (effectiveOrgId) loadDefinitions();
  }, [effectiveOrgId]);

  const loadDefinitions = async () => {
    if (!effectiveOrgId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('custom_attribute_definitions' as any)
        .select('*')
        .eq('org_id', effectiveOrgId)
        .order('category', { ascending: true })
        .order('field_label', { ascending: true });

      if (error) throw error;
      setDefinitions((data as any[]) || []);
    } catch (error) {
      console.error('Error loading custom attribute definitions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!effectiveOrgId || !formData.field_key || !formData.field_label) {
      toast({ title: 'Error', description: 'Field key and label are required', variant: 'destructive' });
      return;
    }

    const key = formData.field_key.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const options = formData.options ? formData.options.split(',').map(o => o.trim()).filter(Boolean) : [];

    try {
      if (editingDef) {
        const { error } = await supabase
          .from('custom_attribute_definitions' as any)
          .update({
            field_label: formData.field_label,
            field_type: formData.field_type,
            options,
            category: formData.category,
            enrichment_prompt: formData.enrichment_prompt || null,
          } as any)
          .eq('id', editingDef.id);
        if (error) throw error;
        toast({ title: 'Updated', description: `Custom attribute "${formData.field_label}" updated` });
      } else {
        const { error } = await supabase
          .from('custom_attribute_definitions' as any)
          .insert({
            org_id: effectiveOrgId,
            field_key: key,
            field_label: formData.field_label,
            field_type: formData.field_type,
            options,
            category: formData.category,
            enrichment_prompt: formData.enrichment_prompt || null,
          } as any);
        if (error) throw error;
        toast({ title: 'Created', description: `Custom attribute "${formData.field_label}" created` });
      }

      setDialogOpen(false);
      resetForm();
      loadDefinitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to save', variant: 'destructive' });
    }
  };

  const handleDelete = async (def: CustomAttributeDefinition) => {
    try {
      const { error } = await supabase
        .from('custom_attribute_definitions' as any)
        .delete()
        .eq('id', def.id);
      if (error) throw error;
      toast({ title: 'Deleted', description: `"${def.field_label}" removed` });
      loadDefinitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const applyTemplate = async (template: TemplateDefinition) => {
    if (!effectiveOrgId) return;

    try {
      const existingKeys = definitions.map(d => d.field_key);
      const newFields = template.fields.filter(f => !existingKeys.includes(f.field_key));

      if (newFields.length === 0) {
        toast({ title: 'Already applied', description: `All ${template.name} fields already exist` });
        return;
      }

      const inserts = newFields.map(f => ({
        org_id: effectiveOrgId,
        field_key: f.field_key,
        field_label: f.field_label,
        field_type: f.field_type,
        options: f.options,
        category: f.category,
        enrichment_prompt: f.enrichment_prompt,
      }));

      const { error } = await supabase
        .from('custom_attribute_definitions' as any)
        .insert(inserts as any);
      if (error) throw error;

      toast({ title: 'Template applied', description: `Added ${newFields.length} ${template.name} attributes` });
      loadDefinitions();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setEditingDef(null);
    setFormData({ field_key: '', field_label: '', field_type: 'text', options: '', category: 'General', enrichment_prompt: '' });
  };

  const openEdit = (def: CustomAttributeDefinition) => {
    setEditingDef(def);
    setFormData({
      field_key: def.field_key,
      field_label: def.field_label,
      field_type: def.field_type,
      options: def.options?.join(', ') || '',
      category: def.category,
      enrichment_prompt: def.enrichment_prompt || '',
    });
    setDialogOpen(true);
  };

  const grouped = definitions.reduce<Record<string, CustomAttributeDefinition[]>>((acc, def) => {
    const cat = def.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(def);
    return acc;
  }, {});

  const typeLabel = (t: string) => {
    switch (t) {
      case 'number': return 'Number';
      case 'text': return 'Text';
      case 'select': return 'Single Select';
      case 'multi_select': return 'Multi Select';
      default: return t;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Custom Vertical Attributes
              </CardTitle>
              <CardDescription>
                Define industry-specific fields to enrich accounts with AI-powered discovery.
                Each attribute includes an enrichment prompt that tells AI providers exactly what to search for.
              </CardDescription>
            </div>
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Attribute
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingDef ? 'Edit' : 'Add'} Custom Attribute</DialogTitle>
                  <DialogDescription>
                    Define a vertical-specific field with an AI enrichment prompt
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Field Label</Label>
                      <Input
                        value={formData.field_label}
                        onChange={(e) => {
                          const label = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            field_label: label,
                            field_key: editingDef ? prev.field_key : label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
                          }));
                        }}
                        placeholder="e.g., Number of Beds"
                      />
                    </div>
                    <div>
                      <Label>Field Key</Label>
                      <Input
                        value={formData.field_key}
                        onChange={(e) => setFormData(prev => ({ ...prev, field_key: e.target.value }))}
                        placeholder="e.g., bed_count"
                        disabled={!!editingDef}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Field Type</Label>
                      <Select value={formData.field_type} onValueChange={(v: any) => setFormData(prev => ({ ...prev, field_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="text">Text</SelectItem>
                          <SelectItem value="select">Single Select</SelectItem>
                          <SelectItem value="multi_select">Multi Select</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Category</Label>
                      <Input
                        value={formData.category}
                        onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                        placeholder="e.g., Healthcare"
                      />
                    </div>
                  </div>
                  {(formData.field_type === 'select' || formData.field_type === 'multi_select') && (
                    <div>
                      <Label>Options (comma-separated)</Label>
                      <Input
                        value={formData.options}
                        onChange={(e) => setFormData(prev => ({ ...prev, options: e.target.value }))}
                        placeholder="Academic Medical Center, Community Hospital, ..."
                      />
                    </div>
                  )}
                  <div>
                    <Label>AI Enrichment Prompt</Label>
                    <Textarea
                      value={formData.enrichment_prompt}
                      onChange={(e) => setFormData(prev => ({ ...prev, enrichment_prompt: e.target.value }))}
                      placeholder="How many licensed hospital beds does this facility have? Return a specific number."
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      This prompt is sent to AI providers (Perplexity, Firecrawl, Gemini) to discover this data for each account.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
                  <Button onClick={handleSave}>{editingDef ? 'Update' : 'Create'}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
      </Card>

      {/* Industry Templates */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Industry Templates</CardTitle>
          <CardDescription>Quick-start with pre-built attribute sets for common verticals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {INDUSTRY_TEMPLATES.map(template => (
              <Button
                key={template.name}
                variant="outline"
                className="h-auto flex-col gap-2 py-4"
                onClick={() => applyTemplate(template)}
              >
                {template.icon}
                <span className="text-sm font-medium">{template.name}</span>
                <span className="text-xs text-muted-foreground">{template.fields.length} fields</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Existing Definitions */}
      {loading ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Loading...</CardContent>
        </Card>
      ) : definitions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No custom attributes defined yet</p>
            <p className="text-sm mt-1">Add attributes manually or apply an industry template above</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, defs]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-base">{category}</CardTitle>
              <CardDescription>{defs.length} attribute{defs.length !== 1 ? 's' : ''}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {defs.map(def => (
                  <div key={def.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{def.field_label}</span>
                        <Badge variant="outline" className="text-xs">{typeLabel(def.field_type)}</Badge>
                        <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{def.field_key}</code>
                      </div>
                      {def.options && def.options.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {def.options.slice(0, 5).map(opt => (
                            <Badge key={opt} variant="secondary" className="text-xs">{opt}</Badge>
                          ))}
                          {def.options.length > 5 && (
                            <Badge variant="secondary" className="text-xs">+{def.options.length - 5} more</Badge>
                          )}
                        </div>
                      )}
                      {def.enrichment_prompt && (
                        <p className="text-xs text-muted-foreground truncate max-w-md">
                          🤖 {def.enrichment_prompt}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 ml-4">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(def)}>
                        <Edit className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(def)} className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

export default CustomAttributeManager;
