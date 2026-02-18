import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Layers, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttributeDefinition {
  id: string;
  field_key: string;
  field_label: string;
  field_type: string;
  options: string[] | null;
  category: string | null;
}

interface CustomAttributesEditorProps {
  accountId: string;
  customAttributes: Record<string, any> | null;
  definitions: AttributeDefinition[];
  onUpdate?: (updated: Record<string, any>) => void;
}

export function CustomAttributesEditor({
  accountId,
  customAttributes,
  definitions,
  onUpdate,
}: CustomAttributesEditorProps) {
  const [localValues, setLocalValues] = useState<Record<string, any>>(
    customAttributes || {}
  );
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  if (definitions.length === 0) return null;

  // Group definitions by category
  const grouped = definitions.reduce<Record<string, AttributeDefinition[]>>(
    (acc, def) => {
      const cat = def.category || "Other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(def);
      return acc;
    },
    {}
  );

  const handleChange = (key: string, value: any) => {
    setLocalValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleMultiSelectToggle = (key: string, option: string) => {
    const current: string[] = Array.isArray(localValues[key])
      ? localValues[key]
      : [];
    const next = current.includes(option)
      ? current.filter((o) => o !== option)
      : [...current, option];
    handleChange(key, next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const merged = { ...(customAttributes || {}), ...localValues };
      const { error } = await supabase
        .from("accounts")
        .update({ custom_attributes: merged } as any)
        .eq("id", accountId);

      if (error) throw error;
      toast.success("Custom attributes saved");
      setDirty(false);
      onUpdate?.(merged);
    } catch (err: any) {
      console.error("Error saving custom attributes:", err);
      toast.error("Failed to save", { description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Vertical Attributes
          </span>
          {dirty && (
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Save className="h-4 w-4 mr-1" />
              )}
              Save
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {Object.entries(grouped).map(([category, defs]) => (
          <div key={category} className="space-y-3">
            <Badge variant="outline" className="text-xs font-medium">
              {category}
            </Badge>
            <div className="grid grid-cols-2 gap-4">
              {defs.map((def) => (
                <FieldRenderer
                  key={def.field_key}
                  definition={def}
                  value={localValues[def.field_key]}
                  onChange={(val) => handleChange(def.field_key, val)}
                  onMultiToggle={(opt) =>
                    handleMultiSelectToggle(def.field_key, opt)
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function FieldRenderer({
  definition,
  value,
  onChange,
  onMultiToggle,
}: {
  definition: AttributeDefinition;
  value: any;
  onChange: (val: any) => void;
  onMultiToggle: (option: string) => void;
}) {
  const { field_type, field_label, options } = definition;

  if (field_type === "number") {
    return (
      <div>
        <Label className="text-sm font-medium">{field_label}</Label>
        <Input
          type="number"
          className="mt-1"
          value={value ?? ""}
          placeholder="Enter value"
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      </div>
    );
  }

  if (field_type === "text") {
    return (
      <div>
        <Label className="text-sm font-medium">{field_label}</Label>
        <Input
          type="text"
          className="mt-1"
          value={value ?? ""}
          placeholder="Enter value"
          onChange={(e) => onChange(e.target.value || null)}
        />
      </div>
    );
  }

  if (field_type === "select" && options?.length) {
    return (
      <div>
        <Label className="text-sm font-medium">{field_label}</Label>
        <Select
          value={value ?? ""}
          onValueChange={(v) => onChange(v || null)}
        >
          <SelectTrigger className="mt-1">
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field_type === "multi_select" && options?.length) {
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="col-span-2">
        <Label className="text-sm font-medium">{field_label}</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {options.map((opt) => (
            <label
              key={opt}
              className="flex items-center gap-1.5 text-sm cursor-pointer"
            >
              <Checkbox
                checked={selected.includes(opt)}
                onCheckedChange={() => onMultiToggle(opt)}
              />
              {opt}
            </label>
          ))}
        </div>
      </div>
    );
  }

  // Fallback: text input
  return (
    <div>
      <Label className="text-sm font-medium">{field_label}</Label>
      <Input
        type="text"
        className="mt-1"
        value={value ?? ""}
        placeholder="Enter value"
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  );
}
