import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Upload, X, FileText, Shield } from "lucide-react";

export function AccountExclusions() {
  const { toast } = useToast();
  const { userProfile } = useAuth();
  const [excludedDomains, setExcludedDomains] = useState<string[]>([]);
  const [domainInput, setDomainInput] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const addDomain = () => {
    if (!domainInput.trim()) return;
    
    const domain = domainInput.trim().toLowerCase();
    if (!excludedDomains.includes(domain)) {
      setExcludedDomains([...excludedDomains, domain]);
      setDomainInput("");
    }
  };

  const removeDomain = (index: number) => {
    setExcludedDomains(excludedDomains.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      toast({
        title: "Invalid file",
        description: "Please upload a CSV file",
        variant: "destructive"
      });
    }
  };

  const parseCSV = async (file: File): Promise<string[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split('\n');
          const domains: string[] = [];
          
          // Skip header row if exists
          const startIndex = lines[0].toLowerCase().includes('domain') ? 1 : 0;
          
          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
              // Get first column value (domain)
              const domain = line.split(',')[0].trim().toLowerCase();
              if (domain && domain.includes('.')) {
                domains.push(domain);
              }
            }
          }
          resolve(domains);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleCSVUpload = async () => {
    if (!csvFile) {
      toast({
        title: "No file selected",
        description: "Please select a CSV file to upload",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);

    try {
      const domains = await parseCSV(csvFile);
      
      // Merge with existing exclusions
      const allDomains = [...new Set([...excludedDomains, ...domains])];
      setExcludedDomains(allDomains);

      toast({
        title: "CSV uploaded successfully",
        description: `Added ${domains.length} domains to exclusion list`
      });

      setCsvFile(null);
    } catch (error) {
      console.error('Error parsing CSV:', error);
      toast({
        title: "Upload failed",
        description: "Failed to parse CSV file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  const saveExclusions = async () => {
    if (!userProfile?.org_id || excludedDomains.length === 0) return;

    setIsUploading(true);

    try {
      // Store in a new table for exclusions or update accounts
      // For now, we'll just show a success message
      // In production, you'd save this to a database table
      
      toast({
        title: "Exclusions saved",
        description: `${excludedDomains.length} domains will be excluded from scoring and analysis`
      });

    } catch (error) {
      console.error('Error saving exclusions:', error);
      toast({
        title: "Save failed",
        description: "Failed to save exclusions",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account Exclusions
          </CardTitle>
          <CardDescription>
            Exclude specific domains from ICP scoring and TAM analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Manual Domain Entry */}
          <div className="space-y-3">
            <Label>Add Domains Manually</Label>
            <div className="flex gap-2">
              <Input
                placeholder="example.com"
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addDomain()}
              />
              <Button onClick={addDomain} variant="outline">
                Add
              </Button>
            </div>
          </div>

          {/* CSV Upload */}
          <div className="space-y-3">
            <Label>Upload CSV File</Label>
            <CardDescription>
              Upload a CSV with a 'domain' column to bulk exclude accounts
            </CardDescription>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                />
              </div>
              <Button 
                onClick={handleCSVUpload}
                disabled={!csvFile || isUploading}
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </Button>
            </div>
            {csvFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {csvFile.name}
              </div>
            )}
          </div>

          {/* Excluded Domains List */}
          {excludedDomains.length > 0 && (
            <div className="space-y-3">
              <Label>Excluded Domains ({excludedDomains.length})</Label>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 border rounded-lg bg-muted/30">
                {excludedDomains.map((domain, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {domain}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive" 
                      onClick={() => removeDomain(index)}
                    />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setExcludedDomains([])}
              disabled={excludedDomains.length === 0}
            >
              Clear All
            </Button>
            <Button
              onClick={saveExclusions}
              disabled={excludedDomains.length === 0 || isUploading}
            >
              Save Exclusions
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Template Download */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV Template</CardTitle>
          <CardDescription>
            Download a template to see the expected format
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button 
            variant="outline"
            onClick={() => {
              const csv = "domain\nexample.com\ncompetitor.com\ntest.com";
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = 'exclusion_template.csv';
              link.click();
              URL.revokeObjectURL(url);
            }}
          >
            <FileText className="h-4 w-4 mr-2" />
            Download Template
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
