import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  orgId: string;
  config: Record<string, unknown> | null;
  onSave: (values: Record<string, unknown>) => Promise<void>;
  onActivate?: () => void;
}

export function OnboardingStepCompany({ orgId, config, onSave }: Props) {
  const [serviceType, setServiceType] = useState<"managed" | "self_service">("managed");
  const [values, setValues] = useState({
    company_name: "",
    logo_url: "",
    brand_primary_color: "#6366f1",
    brand_secondary_color: "#818cf8",
    website_url: "",
    value_proposition: "",
    target_persona_description: "",
    calendly_base_url: "",
    monthly_lead_target: 50,
  });

  useEffect(() => {
    if (config) {
      setValues((prev) => ({
        ...prev,
        company_name: (config.company_name as string) || "",
        logo_url: (config.logo_url as string) || "",
        brand_primary_color: (config.brand_primary_color as string) || "#6366f1",
        brand_secondary_color: (config.brand_secondary_color as string) || "#818cf8",
        website_url: (config.website_url as string) || "",
        value_proposition: (config.value_proposition as string) || "",
        target_persona_description: (config.target_persona_description as string) || "",
        calendly_base_url: (config.calendly_base_url as string) || "",
        monthly_lead_target: (config.monthly_lead_target as number) || 50,
      }));
    }
  }, [config]);

  useEffect(() => {
    // Load service_type from organizations table
    supabase.from("organizations").select("service_type").eq("id", orgId).single().then(({ data }) => {
      if (data?.service_type) setServiceType(data.service_type as "managed" | "self_service");
    });
  }, [orgId]);

  const handleSave = async () => {
    // Save service_type to organizations table separately
    await supabase.from("organizations").update({ service_type: serviceType }).eq("id", orgId);
    await onSave(values);
    toast.success("Company profile saved");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold">Company Profile</h2>
        <p className="text-sm text-muted-foreground">Basic company info for white-labeling funnels and landing pages</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Service Type</Label>
          <Select
            value={serviceType}
            onValueChange={(v) => setServiceType(v as "managed" | "self_service")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="managed">Managed (Consulting)</SelectItem>
              <SelectItem value="self_service">Self-Service (Platform)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Managed: LaunchPulse runs their demand engine. Self-Service: customer has full platform access.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Company Name</Label>
          <Input value={values.company_name} onChange={(e) => setValues({ ...values, company_name: e.target.value })} placeholder="Acme Corp" />
        </div>
        <div className="space-y-2">
          <Label>Website URL</Label>
          <Input value={values.website_url} onChange={(e) => setValues({ ...values, website_url: e.target.value })} placeholder="https://acme.com" />
        </div>
        <div className="space-y-2">
          <Label>Logo URL</Label>
          <Input value={values.logo_url} onChange={(e) => setValues({ ...values, logo_url: e.target.value })} placeholder="https://..." />
        </div>
        <div className="space-y-2">
          <Label>Calendly Base URL</Label>
          <Input value={values.calendly_base_url} onChange={(e) => setValues({ ...values, calendly_base_url: e.target.value })} placeholder="https://calendly.com/acme" />
        </div>
        <div className="space-y-2">
          <Label>Primary Brand Color</Label>
          <div className="flex gap-2">
            <Input type="color" value={values.brand_primary_color} onChange={(e) => setValues({ ...values, brand_primary_color: e.target.value })} className="w-12 h-10 p-1" />
            <Input value={values.brand_primary_color} onChange={(e) => setValues({ ...values, brand_primary_color: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Secondary Brand Color</Label>
          <div className="flex gap-2">
            <Input type="color" value={values.brand_secondary_color} onChange={(e) => setValues({ ...values, brand_secondary_color: e.target.value })} className="w-12 h-10 p-1" />
            <Input value={values.brand_secondary_color} onChange={(e) => setValues({ ...values, brand_secondary_color: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Monthly Lead Target</Label>
          <Input type="number" value={values.monthly_lead_target} onChange={(e) => setValues({ ...values, monthly_lead_target: parseInt(e.target.value) || 50 })} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Value Proposition</Label>
        <Textarea value={values.value_proposition} onChange={(e) => setValues({ ...values, value_proposition: e.target.value })} placeholder="What makes this company unique? Their elevator pitch." rows={3} />
      </div>

      <div className="space-y-2">
        <Label>Target Persona Description</Label>
        <Textarea value={values.target_persona_description} onChange={(e) => setValues({ ...values, target_persona_description: e.target.value })} placeholder="Who is their ideal buyer? Describe the persona." rows={3} />
      </div>

      <Button onClick={handleSave}>Save Company Profile</Button>
    </div>
  );
}
