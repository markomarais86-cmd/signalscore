import { useState, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Phone, Mail, Check, RefreshCw, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EnrichedLead } from "@/hooks/use-enriched-leads";
import { formatDistanceToNow } from "date-fns";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";
import { TableSkeleton } from "@/components/TableSkeleton";

interface EnrichedLeadsTableProps {
  leads: EnrichedLead[];
  selectedIds: Set<number>;
  onSelectionChange: (ids: Set<number>) => void;
  sortField: 'name' | 'enriched_at' | 'enrichment_confidence';
  sortDirection: 'asc' | 'desc';
  onSort: (field: 'name' | 'enriched_at' | 'enrichment_confidence') => void;
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onReEnrich: (lead: EnrichedLead) => void;
  onViewDetails: (lead: EnrichedLead) => void;
}

// Source badge colors
const sourceColors: Record<string, string> = {
  gemini: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-300',
  perplexity: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-300',
  apollo: 'bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-300',
  firecrawl: 'bg-green-500/20 text-green-700 dark:text-green-300 border-green-300',
  pdl: 'bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-300',
};

function getSourceBadgeClass(source: string | null): string {
  if (!source) return 'bg-muted';
  const lower = source.toLowerCase();
  for (const [key, value] of Object.entries(sourceColors)) {
    if (lower.includes(key)) return value;
  }
  return 'bg-muted';
}

function getConfidenceBadge(confidence: number | null) {
  if (confidence === null || confidence === undefined) {
    return <Badge variant="outline" className="text-xs">Unknown</Badge>;
  }
  
  if (confidence >= 80) {
    return <Badge className="bg-[hsl(var(--signal-high))]/20 text-[hsl(var(--signal-high))] border-[hsl(var(--signal-high))]/30 text-xs">{confidence}%</Badge>;
  }
  if (confidence >= 50) {
    return <Badge className="bg-[hsl(var(--signal-medium))]/20 text-[hsl(var(--signal-medium))] border-[hsl(var(--signal-medium))]/30 text-xs">{confidence}%</Badge>;
  }
  return <Badge className="bg-[hsl(var(--signal-low))]/20 text-[hsl(var(--signal-low))] border-[hsl(var(--signal-low))]/30 text-xs">{confidence}%</Badge>;
}

function getPhoneCount(lead: EnrichedLead): number {
  const phones = new Set<string>();
  if (lead.direct_phone) phones.add(lead.direct_phone);
  if (lead.phone) phones.add(lead.phone);
  if (lead.mobile) phones.add(lead.mobile);
  
  if (lead.phones) {
    try {
      const phonesData = typeof lead.phones === 'string' ? JSON.parse(lead.phones) : lead.phones;
      if (Array.isArray(phonesData)) {
        phonesData.forEach((p: any) => {
          if (p.number) phones.add(p.number);
        });
      }
    } catch {}
  }
  
  return phones.size;
}

function SortableHeader({ 
  label, 
  field, 
  currentField, 
  direction, 
  onSort 
}: { 
  label: string; 
  field: 'name' | 'enriched_at' | 'enrichment_confidence'; 
  currentField: string; 
  direction: 'asc' | 'desc'; 
  onSort: (field: 'name' | 'enriched_at' | 'enrichment_confidence') => void;
}) {
  const isActive = currentField === field;
  
  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="h-8 px-2 -ml-2 font-medium"
      onClick={() => onSort(field)}
    >
      {label}
      {isActive ? (
        direction === 'asc' ? <ArrowUp className="ml-1 h-4 w-4" /> : <ArrowDown className="ml-1 h-4 w-4" />
      ) : (
        <ArrowUpDown className="ml-1 h-4 w-4 opacity-50" />
      )}
    </Button>
  );
}

export function EnrichedLeadsTable({
  leads,
  selectedIds,
  onSelectionChange,
  sortField,
  sortDirection,
  onSort,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  onReEnrich,
  onViewDetails
}: EnrichedLeadsTableProps) {
  const observerTarget = useRef<HTMLDivElement>(null);
  const toggleSelectAll = () => {
    if (selectedIds.size === leads.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(leads.map(l => l.id)));
    }
  };

  const toggleSelect = (id: number) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  if (isLoading && leads.length === 0) {
    return <TableSkeleton />;
  }

  if (leads.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-lg font-medium">No enriched leads found</p>
        <p className="text-sm mt-1">Try adjusting your filters or enrich some leads first</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={selectedIds.size === leads.length && leads.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>
                <SortableHeader 
                  label="Name" 
                  field="name" 
                  currentField={sortField} 
                  direction={sortDirection} 
                  onSort={onSort} 
                />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone(s)</TableHead>
              <TableHead>
                <SortableHeader 
                  label="Confidence" 
                  field="enrichment_confidence" 
                  currentField={sortField} 
                  direction={sortDirection} 
                  onSort={onSort} 
                />
              </TableHead>
              <TableHead>Source</TableHead>
              <TableHead>
                <SortableHeader 
                  label="Enriched" 
                  field="enriched_at" 
                  currentField={sortField} 
                  direction={sortDirection} 
                  onSort={onSort} 
                />
              </TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.map((lead) => {
              const fullName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.name || 'Unknown';
              const phoneCount = getPhoneCount(lead);
              
              return (
                <TableRow 
                  key={lead.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onViewDetails(lead)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(lead.id)}
                      onCheckedChange={() => toggleSelect(lead.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {fullName}
                      {lead.linkedin_url && (
                        <a 
                          href={lead.linkedin_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.title || '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.company || '-'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {lead.email ? (
                        <>
                          <span className="text-sm truncate max-w-[150px]">{lead.email}</span>
                          {lead.email_verified && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Check className="h-3 w-3 text-[hsl(var(--signal-high))]" />
                              </TooltipTrigger>
                              <TooltipContent>Email verified</TooltipContent>
                            </Tooltip>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {phoneCount > 0 ? (
                      <Tooltip>
                        <TooltipTrigger>
                          <Badge variant="secondary" className="text-xs">
                            <Phone className="h-3 w-3 mr-1" />
                            {phoneCount}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          {lead.direct_phone || lead.phone || lead.mobile}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getConfidenceBadge(lead.enrichment_confidence)}
                  </TableCell>
                  <TableCell>
                    {lead.enriched_from ? (
                      <Badge variant="outline" className={`text-xs ${getSourceBadgeClass(lead.enriched_from)}`}>
                        {lead.enriched_from.toUpperCase()}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {lead.enriched_at ? formatDistanceToNow(new Date(lead.enriched_at), { addSuffix: true }) : '-'}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewDetails(lead)}>
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onReEnrich(lead)}>
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Re-enrich
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <InfiniteScrollTrigger 
        observerTarget={observerTarget}
        hasMore={hasMore} 
        isLoading={isLoadingMore} 
        onLoadMore={onLoadMore} 
      />
    </TooltipProvider>
  );
}
