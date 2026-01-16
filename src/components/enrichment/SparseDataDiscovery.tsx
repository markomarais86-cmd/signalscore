import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, Users, Building2, Phone, Mail, Linkedin, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useUserProfile } from "@/hooks/use-user-profile";
import { ScrollArea } from "@/components/ui/scroll-area";

interface DiscoveredContact {
  first_name: string | null;
  last_name: string | null;
  full_name: string;
  title: string;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  confidence: number;
  source: string;
}

export function SparseDataDiscovery() {
  const [company, setCompany] = useState("");
  const [domain, setDomain] = useState("");
  const [targetTitles, setTargetTitles] = useState<string[]>(["VP Sales", "Head of Marketing"]);
  const [newTitle, setNewTitle] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [results, setResults] = useState<DiscoveredContact[]>([]);
  const [costEstimate, setCostEstimate] = useState(0);
  const { toast } = useToast();
  const { profile } = useUserProfile();
  const orgId = profile?.org_id;

  const addTitle = () => {
    if (newTitle && !targetTitles.includes(newTitle)) {
      setTargetTitles([...targetTitles, newTitle]);
      setNewTitle("");
    }
  };

  const removeTitle = (title: string) => {
    setTargetTitles(targetTitles.filter(t => t !== title));
  };

  const runDiscovery = async () => {
    if (!orgId) {
      toast({ title: "Organization not found", variant: "destructive" });
      return;
    }

    if (!company) {
      toast({ title: "Company name required", variant: "destructive" });
      return;
    }

    if (targetTitles.length === 0) {
      toast({ title: "Add at least one target title", variant: "destructive" });
      return;
    }

    setDiscovering(true);
    setResults([]);

    try {
      const { data, error } = await supabase.functions.invoke('enrich-discover', {
        body: {
          company,
          domain: domain || undefined,
          target_titles: targetTitles,
          max_results: 10,
          org_id: orgId
        }
      });

      if (error) throw error;

      setResults(data.discovered_contacts || []);
      setCostEstimate(data.cost_estimate || 0);

      toast({
        title: "Discovery complete",
        description: `Found ${data.discovered_contacts?.length || 0} contacts at ${company}`
      });
    } catch (error: any) {
      toast({
        title: "Discovery failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setDiscovering(false);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-100 text-green-700";
    if (confidence >= 60) return "bg-yellow-100 text-yellow-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Sparse Data Discovery
        </CardTitle>
        <CardDescription>
          Find contacts when you only have company + title (no name or email)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input Form */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="company">Company Name *</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="e.g., Tesla"
            />
          </div>
          <div>
            <Label htmlFor="domain">Domain (optional)</Label>
            <Input
              id="domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="e.g., tesla.com"
            />
          </div>
        </div>

        {/* Target Titles */}
        <div>
          <Label>Target Titles</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {targetTitles.map(title => (
              <Badge key={title} variant="secondary" className="flex items-center gap-1">
                {title}
                <button onClick={() => removeTitle(title)} className="ml-1 hover:text-destructive">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Add title (e.g., CTO, Director of Engineering)"
              onKeyDown={(e) => e.key === 'Enter' && addTitle()}
            />
            <Button variant="outline" onClick={addTitle}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Run Discovery Button */}
        <Button 
          onClick={runDiscovery} 
          disabled={discovering || !company || targetTitles.length === 0}
          className="w-full"
        >
          {discovering ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Discovering Contacts...
            </>
          ) : (
            <>
              <Users className="mr-2 h-4 w-4" />
              Discover Contacts
            </>
          )}
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Discovered Contacts ({results.length})</h4>
              <Badge variant="outline">Cost: ${costEstimate.toFixed(3)}</Badge>
            </div>
            
            <ScrollArea className="h-80 border rounded-lg p-3">
              <div className="space-y-3">
                {results.map((contact, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">{contact.full_name}</div>
                        <div className="text-sm text-muted-foreground">{contact.title}</div>
                      </div>
                      <Badge className={getConfidenceColor(contact.confidence)}>
                        {Math.round(contact.confidence)}% confidence
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-3 text-sm">
                      {contact.email && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </div>
                      )}
                      {contact.phone && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </div>
                      )}
                      {contact.linkedin_url && (
                        <a 
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Linkedin className="h-3 w-3" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      Source: {contact.source}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {results.length === 0 && !discovering && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Enter a company and target titles to discover contacts using AI-powered search
          </div>
        )}
      </CardContent>
    </Card>
  );
}
