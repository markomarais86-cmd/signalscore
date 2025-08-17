import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit, Trash2, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface ICP {
  id: string;
  name: string;
  industries: string[];
  company_sizes: number[];
  revenue_ranges: string[];
  geographies: string[];
  created_at: string;
}

const INDUSTRIES = [
  "Technology", "Healthcare", "Financial Services", "Manufacturing", "Retail",
  "Education", "Government", "Real Estate", "Energy", "Transportation"
];

const COMPANY_SIZES = [1, 10, 50, 100, 500, 1000, 5000, 10000];
const REVENUE_RANGES = ["<$1M", "$1M-$5M", "$5M-$25M", "$25M-$100M", "$100M-$500M", "$500M+"];
const GEOGRAPHIES = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East", "Africa"];

export default function ICPManager() {
  const [icps, setIcps] = useState<ICP[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIcp, setEditingIcp] = useState<ICP | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    industries: [] as string[],
    company_sizes: [] as number[],
    revenue_ranges: [] as string[],
    geographies: [] as string[]
  });
  const { userProfile } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (userProfile?.org_id) {
      loadICPs();
    }
  }, [userProfile?.org_id]);

  const loadICPs = async () => {
    if (!userProfile?.org_id) return;
    
    try {
      const { data, error } = await supabase
        .from('icp_profiles')
        .select('*')
        .eq('org_id', userProfile.org_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIcps(data || []);
    } catch (error) {
      console.error('Error loading ICPs:', error);
      toast({
        title: "Error",
        description: "Failed to load ICP profiles",
        variant: "destructive"
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile?.org_id) return;

    try {
      if (editingIcp) {
        const { error } = await supabase
          .from('icp_profiles')
          .update({
            name: formData.name,
            industries: formData.industries,
            company_sizes: formData.company_sizes,
            revenue_ranges: formData.revenue_ranges,
            geographies: formData.geographies
          })
          .eq('id', editingIcp.id);

        if (error) throw error;
        toast({ title: "Success", description: "ICP profile updated" });
      } else {
        const { error } = await supabase
          .from('icp_profiles')
          .insert({
            org_id: userProfile.org_id,
            name: formData.name,
            industries: formData.industries,
            company_sizes: formData.company_sizes,
            revenue_ranges: formData.revenue_ranges,
            geographies: formData.geographies
          });

        if (error) throw error;
        toast({ title: "Success", description: "ICP profile created" });
      }

      setIsDialogOpen(false);
      setEditingIcp(null);
      setFormData({
        name: "",
        industries: [],
        company_sizes: [],
        revenue_ranges: [],
        geographies: []
      });
      loadICPs();
    } catch (error) {
      console.error('Error saving ICP:', error);
      toast({
        title: "Error",
        description: "Failed to save ICP profile",
        variant: "destructive"
      });
    }
  };

  const handleEdit = (icp: ICP) => {
    setEditingIcp(icp);
    setFormData({
      name: icp.name,
      industries: icp.industries || [],
      company_sizes: icp.company_sizes || [],
      revenue_ranges: icp.revenue_ranges || [],
      geographies: icp.geographies || []
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this ICP profile?")) return;

    try {
      const { error } = await supabase
        .from('icp_profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: "Success", description: "ICP profile deleted" });
      loadICPs();
    } catch (error) {
      console.error('Error deleting ICP:', error);
      toast({
        title: "Error",
        description: "Failed to delete ICP profile",
        variant: "destructive"
      });
    }
  };

  const addToArray = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      [field]: [...(prev[field] as any[]), value]
    }));
  };

  const removeFromArray = (field: keyof typeof formData, index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: (prev[field] as any[]).filter((_, i) => i !== index)
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">ICP Manager</h1>
          <p className="text-muted-foreground">Define and manage your Ideal Customer Profiles</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create ICP
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingIcp ? "Edit" : "Create"} ICP Profile</DialogTitle>
              <DialogDescription>
                Define the characteristics of your ideal customer
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">ICP Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Enterprise SaaS Companies"
                  required
                />
              </div>

              <div>
                <Label>Industries</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.industries.map((industry, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('industries', index)}>
                      {industry} ×
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(value) => addToArray('industries', value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Add industry" />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.filter(i => !formData.industries.includes(i)).map(industry => (
                      <SelectItem key={industry} value={industry}>{industry}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Company Sizes (employees)</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.company_sizes.map((size, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('company_sizes', index)}>
                      {size}+ ×
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(value) => addToArray('company_sizes', parseInt(value))}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Add company size" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_SIZES.filter(s => !formData.company_sizes.includes(s)).map(size => (
                      <SelectItem key={size} value={size.toString()}>{size}+ employees</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Revenue Ranges</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.revenue_ranges.map((range, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('revenue_ranges', index)}>
                      {range} ×
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(value) => addToArray('revenue_ranges', value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Add revenue range" />
                  </SelectTrigger>
                  <SelectContent>
                    {REVENUE_RANGES.filter(r => !formData.revenue_ranges.includes(r)).map(range => (
                      <SelectItem key={range} value={range}>{range}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Geographies</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.geographies.map((geo, index) => (
                    <Badge key={index} variant="secondary" className="cursor-pointer" onClick={() => removeFromArray('geographies', index)}>
                      {geo} ×
                    </Badge>
                  ))}
                </div>
                <Select onValueChange={(value) => addToArray('geographies', value)}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Add geography" />
                  </SelectTrigger>
                  <SelectContent>
                    {GEOGRAPHIES.filter(g => !formData.geographies.includes(g)).map(geo => (
                      <SelectItem key={geo} value={geo}>{geo}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editingIcp ? "Update" : "Create"} ICP
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {icps.map((icp) => (
          <Card key={icp.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{icp.name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(icp)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  {userProfile?.role === 'admin' && (
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(icp.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              <CardDescription>
                Created {new Date(icp.created_at).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {icp.industries?.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Industries</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {icp.industries.slice(0, 3).map((industry, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {industry}
                      </Badge>
                    ))}
                    {icp.industries.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{icp.industries.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {icp.company_sizes?.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Company Sizes</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {icp.company_sizes.slice(0, 2).map((size, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {size}+ employees
                      </Badge>
                    ))}
                    {icp.company_sizes.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{icp.company_sizes.length - 2} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {icp.revenue_ranges?.length > 0 && (
                <div>
                  <Label className="text-sm font-medium">Revenue Ranges</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {icp.revenue_ranges.slice(0, 2).map((range, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {range}
                      </Badge>
                    ))}
                    {icp.revenue_ranges.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{icp.revenue_ranges.length - 2} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {icps.length === 0 && (
          <div className="col-span-full">
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Target className="h-12 w-12 text-muted-foreground mb-4" />
                <CardTitle className="text-lg mb-2">No ICP Profiles Yet</CardTitle>
                <CardDescription className="text-center mb-4">
                  Create your first Ideal Customer Profile to start targeting the right accounts
                </CardDescription>
                <Button onClick={() => setIsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First ICP
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}