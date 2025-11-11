import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, ExternalLink } from "lucide-react";

interface Lead {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  title: string | null;
  persona: string | null;
  status: string | null;
}

interface AccountLeadsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountExternalId: string;
  accountName: string;
  leadCount: number;
}

export function AccountLeadsDialog({
  open,
  onOpenChange,
  accountExternalId,
  accountName,
  leadCount,
}: AccountLeadsDialogProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (open && accountExternalId && user?.user_metadata?.organization_id) {
      fetchLeads();
    }
  }, [open, accountExternalId, user?.user_metadata?.organization_id]);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("Leads")
        .select("id, first_name, last_name, email, title, persona, status")
        .eq("org_id", user?.user_metadata?.organization_id)
        .eq("account_external_id", accountExternalId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewAllLeads = () => {
    onOpenChange(false);
    navigate(`/leads?account=${encodeURIComponent(accountExternalId)}`);
  };

  const getPersonaBadgeVariant = (persona: string | null) => {
    if (!persona) return "secondary";
    const lower = persona.toLowerCase();
    if (lower.includes("decision")) return "default";
    if (lower.includes("champion")) return "default";
    if (lower.includes("influencer")) return "secondary";
    return "secondary";
  };

  const getStatusBadgeVariant = (status: string | null) => {
    if (!status) return "secondary";
    const lower = status.toLowerCase();
    if (lower === "open") return "secondary";
    if (lower === "qualified") return "default";
    if (lower === "contacted") return "outline";
    return "secondary";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Contacts at {accountName}
          </DialogTitle>
          <DialogDescription>
            Showing {isLoading ? "..." : leads.length} of {leadCount} total contacts
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mx-6 px-6">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-10 flex-1" />
                  <Skeleton className="h-10 w-48" />
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-24" />
                </div>
              ))}
            </div>
          ) : leads.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-lg font-medium">No contacts found</p>
              <p className="text-sm mt-1">This account doesn't have any contacts yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium">
                      {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}
                    </TableCell>
                    <TableCell>
                      {lead.email ? (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{lead.email}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.title || "—"}
                    </TableCell>
                    <TableCell>
                      {lead.persona ? (
                        <Badge variant={getPersonaBadgeVariant(lead.persona)}>
                          {lead.persona}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {lead.status ? (
                        <Badge variant={getStatusBadgeVariant(lead.status)}>
                          {lead.status}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        {!isLoading && leads.length > 0 && leadCount > 50 && (
          <div className="pt-4 border-t flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              Showing first 50 contacts. View all {leadCount} contacts on the Leads page.
            </p>
            <Button onClick={handleViewAllLeads} variant="outline" size="sm">
              View All Leads
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {!isLoading && leads.length > 0 && leadCount <= 50 && (
          <div className="pt-4 border-t flex justify-end">
            <Button onClick={handleViewAllLeads} variant="outline" size="sm">
              View on Leads Page
              <ExternalLink className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
