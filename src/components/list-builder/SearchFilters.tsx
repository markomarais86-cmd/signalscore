import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, RotateCcw, Building2, Users, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDataOrgId } from "@/hooks/use-data-org";
import {
  ListBuilderFilters,
  REVENUE_BUCKETS,
  EMPLOYEE_RANGES,
  PERSONAS,
  LEVELS,
} from "@/hooks/use-list-builder";

interface SearchFiltersProps {
  filters: ListBuilderFilters;
  setFilters: React.Dispatch<React.SetStateAction<ListBuilderFilters>>;
  onSearch: () => void;
  onReset: () => void;
  isLoading: boolean;
}

interface CustomAttrDef {
  id: string;
  field_key: string;
  display_name: string;
  field_type: string;
  allowed_values: string[] | null;
}

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <Badge
              key={opt}
              variant={isSelected ? "default" : "outline"}
              className="cursor-pointer text-xs transition-colors hover:bg-primary/20"
              onClick={() =>
                onChange(
                  isSelected
                    ? selected.filter((s) => s !== opt)
                    : [...selected, opt]
                )
              }
            >
              {opt}
            </Badge>
          );
        })}
      </div>
    </div>
  );
}

export function SearchFilters({
  filters,
  setFilters,
  onSearch,
  onReset,
  isLoading,
}: SearchFiltersProps) {
  const { dataOrgId } = useDataOrgId();
  const [customAttrDefs, setCustomAttrDefs] = useState<CustomAttrDef[]>([]);

  useEffect(() => {
    if (!dataOrgId) return;
    (supabase
      .from("custom_attribute_definitions" as any)
      .select("id, field_key, display_name, field_type, allowed_values")
      .eq("org_id", dataOrgId)
      .eq("is_active", true)
      .order("display_order", { ascending: true }) as any)
      .then(({ data }: { data: any[] | null }) => {
        if (data) setCustomAttrDefs(data as CustomAttrDef[]);
      });
  }, [dataOrgId]);

  const update = <K extends keyof ListBuilderFilters>(
    key: K,
    value: ListBuilderFilters[K]
  ) => setFilters((prev) => ({ ...prev, [key]: value }));

  const updateCustomAttr = (key: string, value: string) => {
    setFilters((prev) => {
      const next = { ...prev.customAttributes };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return { ...prev, customAttributes: next };
    });
  };

  const customAttrCount = Object.keys(filters.customAttributes).length;

  const activeCount =
    filters.industries.length +
    filters.revenueBuckets.length +
    (filters.employeeMin ? 1 : 0) +
    filters.countries.length +
    filters.businessModels.length +
    (filters.titleKeywords ? 1 : 0) +
    filters.personas.length +
    filters.levels.length +
    (filters.hasEmail !== null ? 1 : 0) +
    (filters.hasPhone !== null ? 1 : 0) +
    customAttrCount;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Search Filters</h3>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeCount}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onReset} className="h-7 text-xs">
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <Tabs defaultValue="company" className="p-4">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            <TabsTrigger value="company" className="text-xs gap-1">
              <Building2 className="h-3 w-3" />
              Company
            </TabsTrigger>
            <TabsTrigger value="people" className="text-xs gap-1">
              <Users className="h-3 w-3" />
              People
            </TabsTrigger>
            <TabsTrigger value="vertical" className="text-xs gap-1">
              <Layers className="h-3 w-3" />
              Vertical
              {customAttrCount > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                  {customAttrCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="space-y-5 mt-0">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Industry Keywords
              </Label>
              <Input
                placeholder="e.g. Software, Healthcare..."
                value={filters.industries.join(", ")}
                onChange={(e) =>
                  update(
                    "industries",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. Matches partial industry names.
              </p>
            </div>

            <MultiSelect
              label="Revenue Range"
              options={REVENUE_BUCKETS}
              selected={filters.revenueBuckets}
              onChange={(v) => update("revenueBuckets", v)}
            />

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Employee Count
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {EMPLOYEE_RANGES.map((range) => {
                  const isSelected =
                    filters.employeeMin === range.min &&
                    filters.employeeMax === range.max;
                  return (
                    <Badge
                      key={range.label}
                      variant={isSelected ? "default" : "outline"}
                      className="cursor-pointer text-xs transition-colors hover:bg-primary/20"
                      onClick={() => {
                        if (isSelected) {
                          update("employeeMin", null);
                          update("employeeMax", null);
                        } else {
                          update("employeeMin", range.min);
                          update("employeeMax", range.max);
                        }
                      }}
                    >
                      {range.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Country
              </Label>
              <Input
                placeholder="e.g. United States, Canada..."
                value={filters.countries.join(", ")}
                onChange={(e) =>
                  update(
                    "countries",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Business Model
              </Label>
              <Input
                placeholder="e.g. B2B, SaaS..."
                value={filters.businessModels.join(", ")}
                onChange={(e) =>
                  update(
                    "businessModels",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                className="h-8 text-sm"
              />
            </div>
          </TabsContent>

          <TabsContent value="people" className="space-y-5 mt-0">
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Title Keywords
              </Label>
              <Input
                placeholder='e.g. "VP Sales", "CTO"...'
                value={filters.titleKeywords}
                onChange={(e) => update("titleKeywords", e.target.value)}
                className="h-8 text-sm"
              />
            </div>

            <MultiSelect
              label="Persona"
              options={PERSONAS}
              selected={filters.personas}
              onChange={(v) => update("personas", v)}
            />

            <MultiSelect
              label="Level"
              options={LEVELS}
              selected={filters.levels}
              onChange={(v) => update("levels", v)}
            />

            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Contact Info
              </Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasEmail"
                  checked={filters.hasEmail === true}
                  onCheckedChange={(c) =>
                    update("hasEmail", c === true ? true : null)
                  }
                />
                <label htmlFor="hasEmail" className="text-sm">
                  Has email
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="hasPhone"
                  checked={filters.hasPhone === true}
                  onCheckedChange={(c) =>
                    update("hasPhone", c === true ? true : null)
                  }
                />
                <label htmlFor="hasPhone" className="text-sm">
                  Has phone
                </label>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="vertical" className="space-y-5 mt-0">
            {customAttrDefs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <Layers className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No custom attributes defined yet.</p>
                <p className="text-xs mt-1">
                  Add custom attributes in Settings to filter by vertical-specific fields.
                </p>
              </div>
            ) : (
              customAttrDefs.map((def) => (
                <div key={def.id} className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {def.display_name}
                  </Label>
                  {def.field_type === "number" ? (
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.customAttributes[`${def.field_key}_min`] || ""}
                        onChange={(e) =>
                          updateCustomAttr(`${def.field_key}_min`, e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.customAttributes[`${def.field_key}_max`] || ""}
                        onChange={(e) =>
                          updateCustomAttr(`${def.field_key}_max`, e.target.value)
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  ) : def.field_type === "select" && def.allowed_values?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {def.allowed_values.map((val) => {
                        const isSelected = filters.customAttributes[def.field_key] === val;
                        return (
                          <Badge
                            key={val}
                            variant={isSelected ? "default" : "outline"}
                            className="cursor-pointer text-xs transition-colors hover:bg-primary/20"
                            onClick={() =>
                              updateCustomAttr(def.field_key, isSelected ? "" : val)
                            }
                          >
                            {val}
                          </Badge>
                        );
                      })}
                    </div>
                  ) : (
                    <Input
                      placeholder={`Filter by ${def.display_name.toLowerCase()}...`}
                      value={filters.customAttributes[def.field_key] || ""}
                      onChange={(e) =>
                        updateCustomAttr(def.field_key, e.target.value)
                      }
                      className="h-8 text-sm"
                    />
                  )}
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </ScrollArea>

      <div className="p-4 border-t">
        <Button onClick={onSearch} disabled={isLoading} className="w-full">
          <Search className="h-4 w-4 mr-2" />
          {isLoading ? "Searching..." : "Search"}
        </Button>
      </div>
    </div>
  );
}
