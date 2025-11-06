/**
 * EXAMPLE: Accounts page with infinite scroll implementation
 * This shows how to integrate cursor-based pagination with infinite scroll
 * 
 * To use: Replace the existing Accounts.tsx loadAccounts function with this approach
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, Download } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useInfiniteAccounts } from "@/hooks/use-infinite-accounts";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { InfiniteScrollTrigger } from "@/components/InfiniteScrollTrigger";
import { TableSkeleton } from "@/components/TableSkeleton";
import { getSourceBadgeVariant } from "@/utils/data-source-attribution";

export default function AccountsInfiniteScrollExample() {
  const { userProfile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);

  // Use the infinite accounts hook
  const {
    accounts,
    isLoading,
    isLoadingMore,
    hasMore,
    totalCount,
    loadMore,
    refresh,
  } = useInfiniteAccounts({
    orgId: userProfile?.org_id || null,
    pageSize: 25,
    searchTerm,
    industryFilter,
    sourceFilter,
    countryFilter,
    enabled: !!userProfile?.org_id,
  });

  // Set up infinite scroll
  const { observerTarget } = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: isLoadingMore,
    rootMargin: '200px', // Start loading when 200px from bottom
  });

  const getScoreBadge = (score: number) => {
    if (score >= 70) return <Badge className="bg-green-500">High Fit</Badge>;
    if (score >= 40) return <Badge className="bg-yellow-500">Medium Fit</Badge>;
    return <Badge className="bg-red-500">Low Fit</Badge>;
  };

  if (isLoading) {
    return <TableSkeleton rows={25} columns={7} showFilters showMetrics />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            Accounts (Infinite Scroll)
          </h1>
          <p className="text-muted-foreground mt-2">
            {totalCount 
              ? `Showing ${accounts.length.toLocaleString()} of ${totalCount.toLocaleString()} accounts`
              : `${accounts.length.toLocaleString()} accounts loaded`
            }
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search accounts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Industry Filter */}
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                <SelectItem value="Technology">Technology</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
              </SelectContent>
            </Select>

            {/* Source Filter */}
            <Select 
              value={sourceFilter || "all"} 
              onValueChange={(v) => setSourceFilter(v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="crm">CRM Only</SelectItem>
                <SelectItem value="database">Database Only</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>

            {/* Country Filter */}
            <Select 
              value={countryFilter || "all"} 
              onValueChange={(v) => setCountryFilter(v === "all" ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Countries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Countries</SelectItem>
                <SelectItem value="United States">United States</SelectItem>
                <SelectItem value="Canada">Canada</SelectItem>
                <SelectItem value="United Kingdom">United Kingdom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Account List</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Industry</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>ICP Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-medium">
                    {account.name || 'Unnamed Account'}
                  </TableCell>
                  <TableCell>{account.domain || '—'}</TableCell>
                  <TableCell>{account.industry_norm || '—'}</TableCell>
                  <TableCell>
                    {account.employee_count 
                      ? account.employee_count.toLocaleString()
                      : '—'
                    }
                  </TableCell>
                  <TableCell>{account.country || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={getSourceBadgeVariant(account.data_source)}>
                      {account.data_source || 'Unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {account.score 
                      ? getScoreBadge(account.score.overall)
                      : <span className="text-muted-foreground">Not scored</span>
                    }
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Infinite Scroll Trigger */}
          <InfiniteScrollTrigger
            observerTarget={observerTarget}
            isLoading={isLoadingMore}
            hasMore={hasMore}
            onLoadMore={loadMore}
            itemsCount={accounts.length}
            totalCount={totalCount || undefined}
          />
        </CardContent>
      </Card>
    </div>
  );
}
