import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { UserSearch, ExternalLink, Mail, Phone, Linkedin } from "lucide-react";
import { LaunchPulseMark } from '@/components/BrandLogo';

interface DiscoveredLead {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  direct_phone: string | null;
  title: string | null;
  linkedin_url: string | null;
  enrichment_confidence: number | null;
  created_at: string;
}

interface DiscoveredLeadsSectionProps {
  accountExternalId: string;
  accountName?: string;
}

export function DiscoveredLeadsSection({ accountExternalId, accountName }: DiscoveredLeadsSectionProps) {
  const { userProfile } = useAuth();
  const [leads, setLeads] = useState<DiscoveredLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadDiscoveredLeads();
  }, [accountExternalId, userProfile?.org_id]);

  const loadDiscoveredLeads = async () => {
    if (!userProfile?.org_id || !accountExternalId) return;

    setLoading(true);
    try {
      const { data, error, count } = await supabase
        .from('Leads')
        .select('id, first_name, last_name, email, phone, direct_phone, title, linkedin_url, enrichment_confidence, created_at', { count: 'exact' })
        .eq('org_id', userProfile.org_id)
        .eq('discovered_from_account', accountExternalId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setLeads(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error('Error loading discovered leads:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserSearch className="h-5 w-5" />
            Discovered Contacts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leads.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserSearch className="h-5 w-5" />
            Discovered Contacts
          </CardTitle>
          <CardDescription>
            AI-discovered decision-makers at this account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <UserSearch className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>No contacts discovered yet</p>
            <p className="text-sm mt-1">
              Enable Contact Discovery in Settings to find decision-makers
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <UserSearch className="h-5 w-5 text-primary" />
            Discovered Contacts
          </span>
          <Badge variant="secondary" className="flex items-center gap-1">
            <LaunchPulseMark className="h-3 w-3" />
            {totalCount} AI-Found
          </Badge>
        </CardTitle>
        <CardDescription>
          Decision-makers discovered via AI enrichment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Confidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => (
              <TableRow key={lead.id}>
                <TableCell className="font-medium">
                  {[lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown'}
                </TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {lead.title || '-'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {lead.email && (
                      <a href={`mailto:${lead.email}`} className="text-primary hover:text-primary/80">
                        <Mail className="h-4 w-4" />
                      </a>
                    )}
                    {(lead.phone || lead.direct_phone) && (
                      <a href={`tel:${lead.direct_phone || lead.phone}`} className="text-primary hover:text-primary/80">
                        <Phone className="h-4 w-4" />
                      </a>
                    )}
                    {lead.linkedin_url && (
                      <a 
                        href={lead.linkedin_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-[#0077b5] hover:text-[#005885]"
                      >
                        <Linkedin className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {lead.enrichment_confidence !== null ? (
                    <Badge variant={
                      lead.enrichment_confidence >= 0.8 ? "default" :
                      lead.enrichment_confidence >= 0.5 ? "secondary" : "outline"
                    }>
                      {Math.round(lead.enrichment_confidence * 100)}%
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {totalCount > 10 && (
          <div className="mt-4 text-center">
            <Button variant="outline" size="sm" asChild>
              <a href={`/leads?discovered_from=${accountExternalId}`}>
                View All {totalCount} Discovered Contacts
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}