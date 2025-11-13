import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, Users, DollarSign, CheckCircle2, ExternalLink, AlertCircle, Loader2 } from "lucide-react";
import { formatNumber } from "@/utils/format-numbers";

interface Account {
  external_id: string;
  name: string | null;
  domain: string | null;
  industry_norm: string | null;
  country: string | null;
  score?: { overall: number } | null;
}

interface Contact {
  first_name: string;
  last_name: string;
  email: string;
  title: string;
  phone?: string;
  linkedin_url?: string;
  account_name: string;
  account_id: string;
  data_quality_score: number;
  previously_exported?: boolean;
  provider?: string;
}

interface CampaignBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: Account[];
}

const PERSONA_TITLES = [
  "VP Sales", "Director Sales", "Head of Sales",
  "VP Marketing", "Director Marketing", "Head of Marketing",
  "VP Revenue", "Chief Revenue Officer", "CRO",
  "VP Business Development", "Director BD",
  "CEO", "COO", "President"
];

const SENIORITY_LEVELS = ["C-Level", "VP", "Director", "Manager"];
const DEPARTMENTS = ["Sales", "Marketing", "Revenue", "Business Development", "Executive"];

export function CampaignBuilder({ isOpen, onClose, accounts: parentAccounts }: CampaignBuilderProps) {
  const { userProfile } = useAuth();
  const { toast } = useToast();
  
  const [step, setStep] = useState(1);
  const [campaignName, setCampaignName] = useState("");
  
  // Account state
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());
  const [accountCount, setAccountCount] = useState(0);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  
  // Persona criteria
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedSeniority, setSelectedSeniority] = useState<string[]>(["VP", "C-Level"]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>(["Sales"]);
  const [maxContactsPerAccount, setMaxContactsPerAccount] = useState(3);
  
  // Provider
  const [provider, setProvider] = useState<'apollo' | 'zoominfo' | 'clearbit'>('apollo');
  
  // Preview
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewContacts, setPreviewContacts] = useState<Contact[]>([]);
  const [selectedContactEmails, setSelectedContactEmails] = useState<Set<string>>(new Set());
  const [estimatedCost, setEstimatedCost] = useState(0);
  
  // Push
  const [isPushing, setIsPushing] = useState(false);
  const [pushProgress, setPushProgress] = useState(0);
  const [campaignResult, setCampaignResult] = useState<any>(null);
  
  // Destination
  const [destination, setDestination] = useState<'salesforce' | 'csv'>('salesforce');
  const [salesforceCampaignId, setSalesforceCampaignId] = useState("");

  useEffect(() => {
    if (isOpen && userProfile?.org_id) {
      // Reset state when modal opens
      setStep(1);
      setCampaignName(`Campaign ${new Date().toLocaleDateString()}`);
      setPreviewContacts([]);
      setSelectedContactEmails(new Set());
      setCampaignResult(null);
      
      // Use the passed accounts directly
      setFilteredAccounts(parentAccounts);
      setSelectedAccountIds(new Set(parentAccounts.map(a => a.external_id)));
      setAccountCount(parentAccounts.length);
    }
  }, [isOpen, userProfile?.org_id, parentAccounts]);


  // Computed values from filtered accounts
  const selectedAccounts = filteredAccounts.filter(a => selectedAccountIds.has(a.external_id));
  
  const avgScore = selectedAccounts.length > 0
    ? Math.round(
        selectedAccounts.reduce((sum, acc) => sum + (acc.score?.overall || 0), 0) / selectedAccounts.length
      )
    : 0;

  const industries = [...new Set(selectedAccounts.map(a => a.industry_norm).filter(Boolean))];
  const countries = [...new Set(selectedAccounts.map(a => a.country).filter(Boolean))];

  useEffect(() => {
    // Calculate cost estimate
    const costPerContact: Record<string, number> = {
      apollo: 0.02,
      zoominfo: 0.10,
      clearbit: 0.05
    };
    const estimatedContactCount = selectedAccounts.length * maxContactsPerAccount;
    setEstimatedCost(estimatedContactCount * costPerContact[provider]);
  }, [selectedAccounts.length, maxContactsPerAccount, provider]);

  const handlePreviewContacts = async () => {
    if (!userProfile?.org_id) return;

    setIsLoadingPreview(true);
    try {
      const { data, error } = await supabase.functions.invoke('find-campaign-contacts', {
        body: {
          org_id: userProfile.org_id,
          account_ids: selectedAccounts.map(a => a.external_id),
          persona_criteria: {
            job_titles: selectedTitles.length > 0 ? selectedTitles : PERSONA_TITLES,
            seniority_levels: selectedSeniority,
            departments: selectedDepartments,
            max_per_account: maxContactsPerAccount
          },
          provider,
          preview_only: true
        }
      });

      if (error) throw error;

      setPreviewContacts(data.contacts || []);
      // Auto-select all contacts
      setSelectedContactEmails(new Set(data.contacts.map((c: Contact) => c.email)));
      setStep(4);
      
      toast({
        title: "Contacts found",
        description: `Found ${data.contacts.length} contacts matching your criteria`
      });
    } catch (error: any) {
      console.error('Error previewing contacts:', error);
      toast({
        title: "Failed to find contacts",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleCreateCampaign = async () => {
    if (!userProfile?.org_id) return;

    setIsPushing(true);
    setPushProgress(0);

    try {
      const finalContacts = previewContacts.filter(c => selectedContactEmails.has(c.email));

      if (destination === 'csv') {
        // Download CSV
        const headers = ['First Name', 'Last Name', 'Email', 'Title', 'Phone', 'LinkedIn', 'Account', 'Quality Score'];
        const rows = finalContacts.map(c => [
          c.first_name,
          c.last_name,
          c.email,
          c.title,
          c.phone || '',
          c.linkedin_url || '',
          c.account_name,
          c.data_quality_score
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${campaignName.replace(/[^a-z0-9]/gi, '_')}.csv`;
        a.click();

        setCampaignResult({
          success: true,
          type: 'csv',
          count: finalContacts.length
        });
        setStep(5);
      } else {
        // Push to Salesforce
        setPushProgress(25);

        const { data, error } = await supabase.functions.invoke('push-campaign-to-crm', {
          body: {
            org_id: userProfile.org_id,
            campaign_name: campaignName,
            campaign_id: salesforceCampaignId || undefined,
            contacts: finalContacts,
            batch_metadata: {
              source_accounts: selectedAccounts.length,
              icp_criteria: {
                avg_score: avgScore,
                industries: industries.slice(0, 3),
                countries: countries.slice(0, 3)
              },
              persona_criteria: {
                titles: selectedTitles,
                seniority: selectedSeniority,
                departments: selectedDepartments
              }
            }
          }
        });

        if (error) throw error;

        setPushProgress(100);
        setCampaignResult(data);
        setStep(5);

        toast({
          title: "Campaign created",
          description: `${data.members_added} contacts added to Salesforce campaign`
        });
      }
    } catch (error: any) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Failed to create campaign",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsPushing(false);
    }
  };

  const toggleContactSelection = (email: string) => {
    const newSet = new Set(selectedContactEmails);
    if (newSet.has(email)) {
      newSet.delete(email);
    } else {
      newSet.add(email);
    }
    setSelectedContactEmails(newSet);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Campaign Builder
          </DialogTitle>
          <DialogDescription>
            Build targeted campaigns from high-fit accounts
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3, 4, 5].map((num) => (
            <div key={num} className="flex items-center flex-1">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                step >= num ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
                {num}
              </div>
              {num < 5 && <div className={`flex-1 h-0.5 ${step > num ? 'bg-primary' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Account Selection */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">Selected Accounts</h3>
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <div className="text-2xl font-bold">{selectedAccounts.length}</div>
                  <div className="text-sm text-muted-foreground">Accounts Selected</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">{avgScore}</div>
                  <div className="text-sm text-muted-foreground">Avg ICP Score</div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm font-medium mb-1">Industries</div>
                  <div className="flex flex-wrap gap-1">
                    {industries.slice(0, 5).map((ind: string | null) => ind && (
                      <Badge key={ind} variant="secondary" className="text-xs">{ind}</Badge>
                    ))}
                    {industries.length > 5 && <Badge variant="outline" className="text-xs">+{industries.length - 5}</Badge>}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-sm font-medium mb-1">Countries</div>
                  <div className="flex flex-wrap gap-1">
                    {countries.slice(0, 5).map((country: string | null) => country && (
                      <Badge key={country} variant="secondary" className="text-xs">{country}</Badge>
                    ))}
                    {countries.length > 5 && <Badge variant="outline" className="text-xs">+{countries.length - 5}</Badge>}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setStep(2)}>Next: Define Personas</Button>
            </div>
          </div>
        )}

        {/* Step 2: Persona Criteria */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Q1 Enterprise Outreach"
              />
            </div>

            <div>
              <Label className="mb-2 block">Job Titles (Optional - leave empty for all)</Label>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded">
                {PERSONA_TITLES.map(title => (
                  <div key={title} className="flex items-center space-x-2">
                    <Checkbox
                      checked={selectedTitles.includes(title)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedTitles([...selectedTitles, title]);
                        } else {
                          setSelectedTitles(selectedTitles.filter(t => t !== title));
                        }
                      }}
                    />
                    <label className="text-sm">{title}</label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Seniority Levels</Label>
              <div className="flex flex-wrap gap-2">
                {SENIORITY_LEVELS.map(level => (
                  <Badge
                    key={level}
                    variant={selectedSeniority.includes(level) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (selectedSeniority.includes(level)) {
                        setSelectedSeniority(selectedSeniority.filter(l => l !== level));
                      } else {
                        setSelectedSeniority([...selectedSeniority, level]);
                      }
                    }}
                  >
                    {level}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Departments</Label>
              <div className="flex flex-wrap gap-2">
                {DEPARTMENTS.map(dept => (
                  <Badge
                    key={dept}
                    variant={selectedDepartments.includes(dept) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => {
                      if (selectedDepartments.includes(dept)) {
                        setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                      } else {
                        setSelectedDepartments([...selectedDepartments, dept]);
                      }
                    }}
                  >
                    {dept}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <Label>Max Contacts per Account</Label>
              <Select value={String(maxContactsPerAccount)} onValueChange={(v) => setMaxContactsPerAccount(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 contact</SelectItem>
                  <SelectItem value="2">2 contacts</SelectItem>
                  <SelectItem value="3">3 contacts</SelectItem>
                  <SelectItem value="5">5 contacts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next: Choose Provider</Button>
            </div>
          </div>
        )}

        {/* Step 3: Provider Selection */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <Label className="mb-3 block">Contact Data Provider</Label>
              <div className="space-y-2">
                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    provider === 'apollo' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setProvider('apollo')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Apollo</div>
                      <div className="text-sm text-muted-foreground">$0.02 per contact • Best value</div>
                    </div>
                    <Badge variant={provider === 'apollo' ? 'default' : 'outline'}>Recommended</Badge>
                  </div>
                </div>

                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    provider === 'zoominfo' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setProvider('zoominfo')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">ZoomInfo</div>
                      <div className="text-sm text-muted-foreground">$0.10 per contact • Premium data</div>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    provider === 'clearbit' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setProvider('clearbit')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Clearbit</div>
                      <div className="text-sm text-muted-foreground">$0.05 per contact • Good balance</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Alert>
              <DollarSign className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Estimated Results</div>
                <div className="text-sm space-y-1">
                  <div>~ {selectedAccounts.length * maxContactsPerAccount} contacts</div>
                  <div>Estimated cost: ${estimatedCost.toFixed(2)}</div>
                </div>
              </AlertDescription>
            </Alert>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>Back</Button>
              <Button onClick={handlePreviewContacts} disabled={isLoadingPreview}>
                {isLoadingPreview ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Finding Contacts...
                  </>
                ) : (
                  'Preview Contacts'
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Preview & Validate */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-medium">Found {previewContacts.length} Contacts</h3>
                  <Badge variant="outline" className="text-xs">
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full mr-1.5 animate-pulse"></span>
                    Live from {provider.charAt(0).toUpperCase() + provider.slice(1)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedContactEmails.size} selected • {previewContacts.filter(c => c.previously_exported).length} previously exported
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedContactEmails.size === previewContacts.length) {
                    setSelectedContactEmails(new Set());
                  } else {
                    setSelectedContactEmails(new Set(previewContacts.map(c => c.email)));
                  }
                }}
              >
                {selectedContactEmails.size === previewContacts.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>

            <div className="border rounded-lg max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewContacts.map((contact) => (
                    <TableRow key={contact.email} className={contact.previously_exported ? 'bg-muted/30' : ''}>
                      <TableCell>
                        <Checkbox
                          checked={selectedContactEmails.has(contact.email)}
                          onCheckedChange={() => toggleContactSelection(contact.email)}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{contact.first_name} {contact.last_name}</div>
                          <div className="text-xs text-muted-foreground">{contact.email}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{contact.title}</TableCell>
                      <TableCell className="text-sm">{contact.account_name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1.5">
                          <Badge variant={contact.data_quality_score >= 80 ? 'default' : 'secondary'} className="text-xs">
                            {contact.data_quality_score}%
                          </Badge>
                          {contact.previously_exported && (
                            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">
                              Previously Exported
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={() => setStep(5)} disabled={selectedContactEmails.size === 0}>
                Next: Choose Destination
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Destination */}
        {step === 5 && !campaignResult && (
          <div className="space-y-4">
            <div>
              <Label className="mb-3 block">Campaign Destination</Label>
              <div className="space-y-2">
                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    destination === 'salesforce' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setDestination('salesforce')}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Push to Salesforce Campaign</div>
                      <div className="text-sm text-muted-foreground">Sync directly to your CRM</div>
                    </div>
                    <Badge variant={destination === 'salesforce' ? 'default' : 'outline'}>Recommended</Badge>
                  </div>
                </div>

                <div
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                    destination === 'csv' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setDestination('csv')}
                >
                  <div>
                    <div className="font-medium">Download CSV</div>
                    <div className="text-sm text-muted-foreground">Export for manual upload</div>
                  </div>
                </div>
              </div>
            </div>

            {destination === 'salesforce' && (
              <div>
                <Label>Salesforce Campaign ID (Optional)</Label>
                <Input
                  value={salesforceCampaignId}
                  onChange={(e) => setSalesforceCampaignId(e.target.value)}
                  placeholder="Leave empty to create new campaign"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  If empty, a new campaign will be created with the name: {campaignName}
                </p>
              </div>
            )}

            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium mb-1">Ready to Create Campaign</div>
                <div className="text-sm">
                  {selectedContactEmails.size} contacts will be {destination === 'csv' ? 'exported' : 'pushed to Salesforce'}
                </div>
              </AlertDescription>
            </Alert>

            {isPushing && (
              <div className="space-y-2">
                <Progress value={pushProgress} />
                <p className="text-sm text-center text-muted-foreground">Creating campaign...</p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)} disabled={isPushing}>Back</Button>
              <Button onClick={handleCreateCampaign} disabled={isPushing}>
                {isPushing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Create Campaign
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 5 && campaignResult && (
          <div className="space-y-4 text-center py-8">
            <div className="flex justify-center">
              <div className="h-16 w-16 bg-success/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
            </div>

            <div>
              <h3 className="text-2xl font-bold mb-2">Campaign Created Successfully!</h3>
              {campaignResult.type === 'csv' ? (
                <p className="text-muted-foreground">
                  Downloaded {campaignResult.count} contacts to CSV
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {campaignResult.members_added} contacts added to Salesforce campaign
                </p>
              )}
            </div>

            {campaignResult.campaign_url && (
              <Button variant="outline" asChild>
                <a href={campaignResult.campaign_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Campaign in Salesforce
                </a>
              </Button>
            )}

            <div className="pt-4">
              <Button onClick={onClose} className="w-full">Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
