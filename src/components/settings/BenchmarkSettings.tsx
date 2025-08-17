import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  BarChart3, 
  Upload, 
  Download, 
  RefreshCw,
  Filter,
  Globe,
  Building,
  Users,
  TrendingUp,
  Calendar
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BenchmarkDataset {
  id: string;
  name: string;
  description: string;
  type: 'industry' | 'size' | 'geography' | 'custom';
  filterCriteria: {
    industries?: string[];
    companySizes?: string[];
    geographies?: string[];
    revenueRanges?: string[];
  };
  recordCount: number;
  lastUpdated: string;
  isActive: boolean;
  source: 'builtin' | 'custom' | 'imported';
}

const BENCHMARK_DATASETS: BenchmarkDataset[] = [
  {
    id: 'tech-enterprise',
    name: 'Technology - Enterprise',
    description: 'Enterprise technology companies (1000+ employees)',
    type: 'industry',
    filterCriteria: {
      industries: ['Technology', 'Software', 'SaaS'],
      companySizes: ['1000-5000', '5000+'],
      revenueRanges: ['$100M-$500M', '$500M+']
    },
    recordCount: 15420,
    lastUpdated: '2024-01-15',
    isActive: true,
    source: 'builtin'
  },
  {
    id: 'financial-mid-market',
    name: 'Financial Services - Mid-Market',
    description: 'Mid-market financial services companies',
    type: 'industry',
    filterCriteria: {
      industries: ['Financial Services', 'Banking', 'Insurance'],
      companySizes: ['100-1000'],
      revenueRanges: ['$10M-$100M']
    },
    recordCount: 8734,
    lastUpdated: '2024-01-12',
    isActive: false,
    source: 'builtin'
  },
  {
    id: 'north-america',
    name: 'North America',
    description: 'Companies based in North America',
    type: 'geography',
    filterCriteria: {
      geographies: ['United States', 'Canada', 'Mexico']
    },
    recordCount: 45678,
    lastUpdated: '2024-01-10',
    isActive: false,
    source: 'builtin'
  }
];

const INDUSTRIES = [
  'Technology', 'Software', 'SaaS', 'Financial Services', 'Banking', 'Insurance',
  'Healthcare', 'Manufacturing', 'Retail', 'Real Estate', 'Construction',
  'Energy', 'Telecommunications', 'Media', 'Education'
];

const COMPANY_SIZES = [
  '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001+'
];

const REVENUE_RANGES = [
  '$0-$1M', '$1M-$10M', '$10M-$50M', '$50M-$100M', '$100M-$500M', '$500M+'
];

const GEOGRAPHIES = [
  'United States', 'Canada', 'United Kingdom', 'Germany', 'France', 'Australia',
  'Japan', 'Singapore', 'Brazil', 'Mexico', 'India', 'Netherlands'
];

export default function BenchmarkSettings() {
  const [datasets, setDatasets] = useState<BenchmarkDataset[]>(BENCHMARK_DATASETS);
  const [activeDataset, setActiveDataset] = useState<string>('tech-enterprise');
  const [isCreating, setIsCreating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [newDataset, setNewDataset] = useState({
    name: '',
    description: '',
    type: 'industry' as BenchmarkDataset['type'],
    filterCriteria: {
      industries: [] as string[],
      companySizes: [] as string[],
      geographies: [] as string[],
      revenueRanges: [] as string[]
    }
  });
  const { toast } = useToast();

  const setActive = (datasetId: string) => {
    setDatasets(prev => prev.map(d => 
      ({ ...d, isActive: d.id === datasetId })
    ));
    setActiveDataset(datasetId);
    toast({ title: "Benchmark Updated", description: "Active benchmark dataset changed" });
  };

  const refreshDataset = (datasetId: string) => {
    setDatasets(prev => prev.map(d => 
      d.id === datasetId 
        ? { ...d, lastUpdated: new Date().toISOString().split('T')[0] }
        : d
    ));
    toast({ title: "Dataset Refreshed", description: "Benchmark data has been updated" });
  };

  const createCustomDataset = () => {
    const dataset: BenchmarkDataset = {
      id: `custom-${Date.now()}`,
      name: newDataset.name,
      description: newDataset.description,
      type: newDataset.type,
      filterCriteria: newDataset.filterCriteria,
      recordCount: Math.floor(Math.random() * 10000) + 1000, // Mock count
      lastUpdated: new Date().toISOString().split('T')[0],
      isActive: false,
      source: 'custom'
    };

    setDatasets(prev => [...prev, dataset]);
    setIsCreating(false);
    setNewDataset({
      name: '',
      description: '',
      type: 'industry',
      filterCriteria: { industries: [], companySizes: [], geographies: [], revenueRanges: [] }
    });
    toast({ title: "Success", description: "Custom benchmark dataset created" });
  };

  const exportDataset = (dataset: BenchmarkDataset) => {
    // Mock export functionality
    const dataStr = JSON.stringify(dataset, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${dataset.name.toLowerCase().replace(/\s+/g, '-')}-benchmark.json`;
    link.click();
    toast({ title: "Exported", description: `${dataset.name} benchmark data exported` });
  };

  const getTypeIcon = (type: BenchmarkDataset['type']) => {
    switch (type) {
      case 'industry': return Building;
      case 'size': return Users;
      case 'geography': return Globe;
      case 'custom': return Filter;
      default: return BarChart3;
    }
  };

  const getTypeBadge = (type: BenchmarkDataset['type']) => {
    const colors = {
      industry: 'bg-blue-500',
      size: 'bg-green-500',
      geography: 'bg-purple-500',
      custom: 'bg-orange-500'
    };
    return <Badge className={colors[type]}>{type}</Badge>;
  };

  const getSourceBadge = (source: BenchmarkDataset['source']) => {
    const variants = {
      builtin: 'default' as const,
      custom: 'secondary' as const,
      imported: 'outline' as const
    };
    return <Badge variant={variants[source]}>{source}</Badge>;
  };

  const updateFilterCriteria = (field: keyof typeof newDataset.filterCriteria, values: string[]) => {
    setNewDataset(prev => ({
      ...prev,
      filterCriteria: {
        ...prev.filterCriteria,
        [field]: values
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Benchmark Settings</h3>
          <p className="text-sm text-muted-foreground">Configure benchmark datasets for performance comparison</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isImporting} onOpenChange={setIsImporting}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Import Dataset
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Benchmark Dataset</DialogTitle>
                <DialogDescription>Upload a CSV or JSON file with benchmark data</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Dataset File</Label>
                  <Input type="file" accept=".csv,.json" />
                </div>
                <div>
                  <Label>Dataset Name</Label>
                  <Input placeholder="My Custom Benchmark" />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsImporting(false)}>Cancel</Button>
                <Button onClick={() => {
                  setIsImporting(false);
                  toast({ title: "Imported", description: "Benchmark dataset imported successfully" });
                }}>
                  Import
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreating} onOpenChange={setIsCreating}>
            <DialogTrigger asChild>
              <Button>
                <Filter className="h-4 w-4 mr-2" />
                Create Custom Dataset
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create Custom Benchmark Dataset</DialogTitle>
                <DialogDescription>Define criteria for your custom benchmark comparison</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Dataset Name</Label>
                    <Input 
                      value={newDataset.name}
                      onChange={(e) => setNewDataset(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="e.g., Enterprise SaaS Companies"
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select 
                      value={newDataset.type} 
                      onValueChange={(value: BenchmarkDataset['type']) => 
                        setNewDataset(prev => ({ ...prev, type: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="industry">Industry-based</SelectItem>
                        <SelectItem value="size">Size-based</SelectItem>
                        <SelectItem value="geography">Geography-based</SelectItem>
                        <SelectItem value="custom">Custom criteria</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Description</Label>
                  <Input 
                    value={newDataset.description}
                    onChange={(e) => setNewDataset(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe what this benchmark represents"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Industries</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select industries" />
                      </SelectTrigger>
                      <SelectContent>
                        {INDUSTRIES.map(industry => (
                          <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Company Sizes</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select company sizes" />
                      </SelectTrigger>
                      <SelectContent>
                        {COMPANY_SIZES.map(size => (
                          <SelectItem key={size} value={size}>{size} employees</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Revenue Ranges</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select revenue ranges" />
                      </SelectTrigger>
                      <SelectContent>
                        {REVENUE_RANGES.map(range => (
                          <SelectItem key={range} value={range}>{range}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Geographies</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select regions" />
                      </SelectTrigger>
                      <SelectContent>
                        {GEOGRAPHIES.map(geo => (
                          <SelectItem key={geo} value={geo}>{geo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreating(false)}>Cancel</Button>
                <Button onClick={createCustomDataset}>Create Dataset</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Active Dataset Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Active Benchmark Dataset</CardTitle>
          <CardDescription>Currently selected dataset for performance comparisons</CardDescription>
        </CardHeader>
        <CardContent>
          {datasets.find(d => d.isActive) && (() => {
            const active = datasets.find(d => d.isActive)!;
            const Icon = getTypeIcon(active.type);
            return (
              <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold">{active.name}</h4>
                    <p className="text-sm text-muted-foreground">{active.description}</p>
                    <div className="flex gap-2 mt-2">
                      {getTypeBadge(active.type)}
                      {getSourceBadge(active.source)}
                      <Badge variant="outline">{active.recordCount.toLocaleString()} records</Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Last updated</div>
                  <div className="font-medium">{active.lastUpdated}</div>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => refreshDataset(active.id)}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Available Datasets */}
      <Card>
        <CardHeader>
          <CardTitle>Available Benchmark Datasets</CardTitle>
          <CardDescription>Select different datasets for comparison analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {datasets.map(dataset => {
              const Icon = getTypeIcon(dataset.type);
              return (
                <div key={dataset.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 ${dataset.isActive ? 'bg-primary' : 'bg-muted'} rounded-lg flex items-center justify-center`}>
                      <Icon className={`h-5 w-5 ${dataset.isActive ? 'text-white' : 'text-muted-foreground'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium">{dataset.name}</h4>
                        {dataset.isActive && <Badge>Active</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{dataset.description}</p>
                      <div className="flex gap-2 mt-1">
                        {getTypeBadge(dataset.type)}
                        {getSourceBadge(dataset.source)}
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {dataset.lastUpdated}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {dataset.recordCount.toLocaleString()} records
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {!dataset.isActive && (
                      <Button variant="outline" size="sm" onClick={() => setActive(dataset.id)}>
                        Set Active
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => refreshDataset(dataset.id)}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => exportDataset(dataset)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Performance Comparison Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Benchmark Performance Preview</CardTitle>
          <CardDescription>How your performance compares to the active benchmark</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="font-medium">Conversion Rate</span>
              </div>
              <div className="text-2xl font-bold">8.5%</div>
              <div className="text-sm text-green-600">+2.1% vs benchmark</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span className="font-medium">Lead Quality Score</span>
              </div>
              <div className="text-2xl font-bold">78</div>
              <div className="text-sm text-blue-600">-5 vs benchmark</div>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-purple-500" />
                <span className="font-medium">Pipeline Velocity</span>
              </div>
              <div className="text-2xl font-bold">32 days</div>
              <div className="text-sm text-purple-600">-8 days vs benchmark</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}