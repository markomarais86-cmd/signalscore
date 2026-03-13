import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useSuppressionRules } from "@/hooks/use-suppression-rules";
import { Upload, X, FileText, Shield, Loader2, Trash2 } from "lucide-react";

export function AccountExclusions() {
  const { toast } = useToast();
  const { rules, isLoading, addRules, removeRule, totalCount } = useSuppressionRules();
  const [domainInput, setDomainInput] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Pending domains not yet saved
  const [pendingDomains, setPendingDomains] = useState<string[]>([]);

  const addDomain = () => {
    const domain = domainInput.trim().toLowerCase();
    if (!domain) return;
    if (!pendingDomains.includes(domain)) {
      setPendingDomains(prev => [...prev, domain]);
      setDomainInput("");
    }
  };

  const removePending = (index: number) => {
    setPendingDomains(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
    } else {
      toast({ title: "Invalid file", description: "Please upload a CSV file", variant: "destructive" });
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
          const startIndex = lines[0].toLowerCase().includes('domain') ? 1 : 0;
          for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
              const domain = line.split(',')[0].trim().toLowerCase();
              if (domain && domain.includes('.')) domains.push(domain);
            }
          }
          resolve(domains);
        } catch (error) { reject(error); }
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleCSVUpload = async () => {
    if (!csvFile) return;
    setIsUploading(true);
    try {
      const domains = await parseCSV(csvFile);
      const allDomains = [...new Set([...pendingDomains, ...domains])];
      setPendingDomains(allDomains);
      toast({ title: "CSV parsed", description: `Added ${domains.length} domains to pending list` });
      setCsvFile(null);
    } catch {
      toast({ title: "Upload failed", description: "Failed to parse CSV file", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const savePending = async () => {
    if (pendingDomains.length === 0) return;
    setIsUploading(true);
    try {
      await addRules.mutateAsync(
        pendingDomains.map(d => ({ type: 'domain' as const, value: d, reason: 'Manual exclusion' }))
      );
      setPendingDomains([]);
      toast({ title: "Exclusions saved", description: `${pendingDomains.length} domains added to suppression list` });
    } catch {
      toast({ title: "Save failed", description: "Failed to save exclusions", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveRule = async (ruleId: string) => {
    try {
      await removeRule.mutateAsync(ruleId);
      toast({ title: "Removed", description: "Suppression rule removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove rule", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account Exclusions
          </CardTitle>
          <CardDescription>
            Exclude specific domains from ICP scoring, TAM analysis, and campaign targeting.
            {totalCount > 0 && <span className="ml-1 font-medium">({totalCount} active rules)</span>}
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
                onKeyDown={(e) => e.key === 'Enter' && addDomain()}
              />
              <Button onClick={addDomain} variant="outline">Add</Button>
            </div>
          </div>

          {/* CSV Upload */}
          <div className="space-y-3">
            <Label>Upload CSV File</Label>
            <CardDescription>Upload a CSV with a 'domain' column to bulk exclude accounts</CardDescription>
            <div className="flex gap-2">
              <div className="flex-1">
                <Input type="file" accept=".csv" onChange={handleFileChange} className="cursor-pointer" />
              </div>
              <Button onClick={handleCSVUpload} disabled={!csvFile || isUploading} variant="outline">
                <Upload className="h-4 w-4 mr-2" />Upload
              </Button>
            </div>
            {csvFile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />{csvFile.name}
              </div>
            )}
          </div>

          {/* Pending Domains */}
          {pendingDomains.length > 0 && (
            <div className="space-y-3">
              <Label>Pending Domains ({pendingDomains.length})</Label>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 border rounded-lg bg-muted/30">
                {pendingDomains.map((domain, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    {domain}
                    <X className="h-3 w-3 cursor-pointer hover:text-destructive" onClick={() => removePending(index)} />
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Save / Clear */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setPendingDomains([])} disabled={pendingDomains.length === 0}>
              Clear Pending
            </Button>
            <Button onClick={savePending} disabled={pendingDomains.length === 0 || isUploading}>
              {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Exclusions
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Suppression Rules */}
      {rules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Suppression Rules ({rules.length})</CardTitle>
            <CardDescription>These domains/emails are excluded from all campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {rules.map(rule => (
                <div key={rule.id} className="flex items-center justify-between p-2 rounded-lg border bg-muted/20">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{rule.suppression_type}</Badge>
                    <span className="text-sm font-mono">{rule.domain || rule.email}</span>
                    <span className="text-xs text-muted-foreground">— {rule.reason}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveRule(rule.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Template Download */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CSV Template</CardTitle>
          <CardDescription>Download a template to see the expected format</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => {
            const csv = "domain\nexample.com\ncompetitor.com\ntest.com";
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'exclusion_template.csv';
            link.click();
            URL.revokeObjectURL(url);
          }}>
            <FileText className="h-4 w-4 mr-2" />Download Template
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
