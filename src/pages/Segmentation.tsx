import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSegments } from '@/hooks/use-segments';
import { Filter, Plus, Users, Trash2, Edit, X, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WelcomeEmptyState } from '@/components/onboarding/WelcomeEmptyState';
import { cn } from '@/lib/utils';

const INDUSTRY_OPTIONS = [
  'Technology', 'Financial Services', 'Healthcare', 'Manufacturing',
  'Retail', 'Media', 'Education', 'Energy', 'Real Estate',
  'Transportation', 'Telecommunications', 'Hospitality',
];

const REVENUE_OPTIONS = [
  '$1M-$5M', '$5M-$10M', '$10M-$50M', '$50M-$100M', '$100M-$500M', '$500M-$1B', '$1B+',
];

const GEO_OPTIONS = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'France',
  'Australia', 'Netherlands', 'Singapore', 'Japan', 'Brazil',
  'India', 'South Africa',
];

interface SegmentCriteria {
  industries: string[];
  revenue_ranges: string[];
  geographies: string[];
  score_min: number;
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-auto min-h-10 py-2">
          <span className="flex flex-wrap gap-1 text-left">
            {selected.length === 0 ? (
              <span className="text-muted-foreground">Select {label.toLowerCase()}...</span>
            ) : (
              selected.map((v) => (
                <Badge key={v} variant="secondary" className="text-xs font-normal">
                  {v}
                  <button
                    className="ml-1 hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(v);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0" align="start">
        <ScrollArea className="h-[240px]">
          <div className="p-2 space-y-1">
            {options.map((option) => (
              <label
                key={option}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer hover:bg-accent text-sm"
              >
                <Checkbox
                  checked={selected.includes(option)}
                  onCheckedChange={() => toggle(option)}
                />
                {option}
              </label>
            ))}
          </div>
        </ScrollArea>
        {selected.length > 0 && (
          <div className="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => onChange([])}
            >
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default function Segmentation() {
  const { segments, isLoading, createSegment, deleteSegment } = useSegments();
  const { toast } = useToast();
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [criteria, setCriteria] = useState<SegmentCriteria>({
    industries: [],
    revenue_ranges: [],
    geographies: [],
    score_min: 0,
  });

  const resetForm = () => {
    setName('');
    setDescription('');
    setCriteria({ industries: [], revenue_ranges: [], geographies: [], score_min: 0 });
    setIsCreating(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter a segment name', variant: 'destructive' });
      return;
    }

    const hasCriteria = criteria.industries.length > 0 || criteria.revenue_ranges.length > 0 ||
      criteria.geographies.length > 0 || criteria.score_min > 0;

    if (!hasCriteria) {
      toast({ title: 'Validation Error', description: 'Add at least one filter criterion', variant: 'destructive' });
      return;
    }

    await createSegment({
      name: name.trim(),
      description: description.trim() || null,
      query_config: criteria,
    });
    resetForm();
  };

  const activeFilterCount = [
    criteria.industries.length > 0,
    criteria.revenue_ranges.length > 0,
    criteria.geographies.length > 0,
    criteria.score_min > 0,
  ].filter(Boolean).length;

  const renderCriteriaSummary = (config: any) => {
    if (!config) return null;
    const parts: string[] = [];
    if (config.industries?.length) parts.push(`${config.industries.length} industries`);
    if (config.revenue_ranges?.length) parts.push(`${config.revenue_ranges.length} revenue ranges`);
    if (config.geographies?.length) parts.push(`${config.geographies.length} geographies`);
    if (config.score_min > 0) parts.push(`score ≥ ${config.score_min}`);
    return parts.length > 0 ? parts.join(' · ') : 'No criteria';
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Segmentation</h1>
            <p className="text-muted-foreground mt-2">
              Create dynamic segments to organize and target accounts
            </p>
          </div>
          <Button onClick={() => setIsCreating(!isCreating)}>
            <Plus className="h-4 w-4 mr-2" />
            New Segment
          </Button>
        </div>

        {isCreating && (
          <Card>
            <CardHeader>
              <CardTitle>Create New Segment</CardTitle>
              <CardDescription>
                Define your segment using the filters below
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">{activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active</Badge>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Name & Description */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="seg-name">Segment Name</Label>
                  <Input
                    id="seg-name"
                    placeholder="e.g. Enterprise SaaS — US"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="seg-desc">Description (optional)</Label>
                  <Input
                    id="seg-desc"
                    placeholder="High-value enterprise accounts..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </div>

              {/* Filter Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Industries</Label>
                  <MultiSelectDropdown
                    label="Industries"
                    options={INDUSTRY_OPTIONS}
                    selected={criteria.industries}
                    onChange={(v) => setCriteria({ ...criteria, industries: v })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Revenue Range</Label>
                  <MultiSelectDropdown
                    label="Revenue Ranges"
                    options={REVENUE_OPTIONS}
                    selected={criteria.revenue_ranges}
                    onChange={(v) => setCriteria({ ...criteria, revenue_ranges: v })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Geography</Label>
                  <MultiSelectDropdown
                    label="Countries"
                    options={GEO_OPTIONS}
                    selected={criteria.geographies}
                    onChange={(v) => setCriteria({ ...criteria, geographies: v })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Minimum Score: {criteria.score_min}</Label>
                  <div className="pt-2 px-1">
                    <Slider
                      value={[criteria.score_min]}
                      onValueChange={([v]) => setCriteria({ ...criteria, score_min: v })}
                      min={0}
                      max={100}
                      step={5}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>0</span>
                      <span>50</span>
                      <span>100</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={handleCreate}>
                  <Filter className="h-4 w-4 mr-2" />
                  Create Segment
                </Button>
                <Button variant="outline" onClick={resetForm}>Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Segment List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {segments.map((segment) => (
            <Card key={segment.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <Users className="h-8 w-8 text-primary" />
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => deleteSegment(segment.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <CardTitle className="text-lg">{segment.name}</CardTitle>
                {segment.description && (
                  <CardDescription>{segment.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Accounts</span>
                    <Badge variant="secondary">{segment.account_count}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {renderCriteriaSummary(segment.query_config)}
                  </p>
                  <Button size="sm" variant="outline" className="w-full">
                    <Filter className="h-4 w-4 mr-1" />
                    View Accounts
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {segments.length === 0 && !isCreating && !isLoading && (
          <div className="space-y-4">
            <WelcomeEmptyState highlightStep="upload_data" compact />
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">Or create a segment to organize accounts</p>
              <Button variant="outline" onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Segment
              </Button>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
