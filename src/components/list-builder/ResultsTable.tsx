import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronDown, ChevronRight, Download, Users, Globe, Building2, ExternalLink } from "lucide-react";
import { ListBuilderResult } from "@/hooks/use-list-builder";
import { supabase } from "@/integrations/supabase/client";
import { useEffectiveOrg } from "@/hooks/use-effective-org";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface ResultsTableProps {
  results: ListBuilderResult[];
  totalAccounts: number;
  isLoading: boolean;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  exportCsv: () => void;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  searchTriggered: boolean;
}

function ExpandedLeads({ externalId }: { externalId: string }) {
  const { effectiveOrgId } = useEffectiveOrg();
  const { data: leads, isLoading } = useQuery({
    queryKey: ["list-builder-leads", externalId, effectiveOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("Leads")
        .select("id, first_name, last_name, title, email, phone, persona, level")
        .eq("account_external_id", externalId)
        .eq("org_id", effectiveOrgId!)
        .limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!effectiveOrgId,
  });

  if (isLoading) return <Skeleton className="h-16 mx-4 my-2" />;
  if (!leads?.length) return <p className="text-xs text-muted-foreground px-12 py-2">No leads found</p>;

  return (
    <div className="px-12 py-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground border-b">
            <th className="text-left py-1 font-medium">Name</th>
            <th className="text-left py-1 font-medium">Title</th>
            <th className="text-left py-1 font-medium">Persona</th>
            <th className="text-left py-1 font-medium">Email</th>
            <th className="text-left py-1 font-medium">Phone</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-border/30">
              <td className="py-1.5">{[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}</td>
              <td className="py-1.5">{lead.title || "—"}</td>
              <td className="py-1.5">
                {lead.persona && <Badge variant="outline" className="text-xs">{lead.persona}</Badge>}
              </td>
              <td className="py-1.5 text-primary">{lead.email || "—"}</td>
              <td className="py-1.5">{lead.phone || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ResultsTable({
  results,
  totalAccounts,
  isLoading,
  selectedIds,
  toggleSelect,
  selectAll,
  clearSelection,
  exportCsv,
  page,
  setPage,
  pageSize,
  searchTriggered,
}: ResultsTableProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!searchTriggered) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center space-y-2">
          <Building2 className="h-12 w-12 mx-auto opacity-30" />
          <p className="text-sm">Set your filters and click Search to find prospects</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 p-6 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  const totalPages = Math.ceil(totalAccounts / pageSize);
  const allSelected = results.length > 0 && results.every((r) => selectedIds.has(r.account_id));

  return (
    <div className="flex flex-col h-full">
      {/* Actions bar */}
      <div className="p-3 border-b flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium">
            <span className="text-primary font-bold">{totalAccounts.toLocaleString()}</span>{" "}
            accounts found
          </p>
          {selectedIds.size > 0 && (
            <Badge variant="secondary" className="text-xs">
              {selectedIds.size} selected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearSelection} className="text-xs h-7">
              Clear
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs h-7">
              Select All
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCsv} className="text-xs h-7">
            <Download className="h-3 w-3 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={() => (allSelected ? clearSelection() : selectAll())}
                />
              </TableHead>
              <TableHead className="w-8"></TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Revenue</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead>Location</TableHead>
              <TableHead className="text-center">
                <Users className="h-3.5 w-3.5 mx-auto" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  No accounts match your criteria. Try adjusting your filters.
                </TableCell>
              </TableRow>
            ) : (
              results.map((r) => (
                <>
                  <TableRow
                    key={r.account_id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(r.account_id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(r.account_id)}
                        onCheckedChange={() => toggleSelect(r.account_id)}
                      />
                    </TableCell>
                    <TableCell>
                      {expandedIds.has(r.account_id) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{r.account_name || "Unknown"}</span>
                        {r.domain && (
                          <a
                            href={`https://${r.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted-foreground hover:text-primary"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        {r.icp_qualified && (
                          <Badge variant="default" className="text-xs px-1 py-0">ICP</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {r.industry || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{r.revenue_bucket}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.employee_count?.toLocaleString() || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {[r.city, r.state_province, r.country].filter(Boolean).join(", ") || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs">
                        {r.lead_count}
                      </Badge>
                    </TableCell>
                  </TableRow>
                  {expandedIds.has(r.account_id) && (
                    <TableRow key={`${r.account_id}-leads`}>
                      <TableCell colSpan={8} className="p-0 bg-muted/30">
                        <ExpandedLeads externalId={r.external_id} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="p-3 border-t flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="text-xs h-7"
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage(page + 1)}
              className="text-xs h-7"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
