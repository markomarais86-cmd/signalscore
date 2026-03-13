import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDataOrgId } from "@/hooks/use-data-org";
import { toast } from "sonner";
import { callCustomRpc } from "@/types/supabase-rpc";

export interface ListBuilderFilters {
  industries: string[];
  revenueBuckets: string[];
  employeeMin: number | null;
  employeeMax: number | null;
  countries: string[];
  states: string[];
  cities: string[];
  businessModels: string[];
  titleKeywords: string;
  personas: string[];
  levels: string[];
  hasEmail: boolean | null;
  hasPhone: boolean | null;
  customAttributes: Record<string, string>;
  fitScoreMin: number | null;
  fitScoreMax: number | null;
}

export interface ListBuilderResult {
  account_id: string;
  external_id: string;
  account_name: string;
  industry: string | null;
  revenue_range: string | null;
  revenue_bucket: string;
  employee_count: number | null;
  country: string | null;
  state_province: string | null;
  city: string | null;
  domain: string | null;
  business_model: string | null;
  icp_qualified: boolean | null;
  lead_count: number;
  total_accounts: number;
  fit_score: number;
  overall_score: number;
  intent_score: number;
}

export const EMPTY_FILTERS: ListBuilderFilters = {
  industries: [],
  revenueBuckets: [],
  employeeMin: null,
  employeeMax: null,
  countries: [],
  states: [],
  cities: [],
  businessModels: [],
  titleKeywords: "",
  personas: [],
  levels: [],
  hasEmail: null,
  hasPhone: null,
  customAttributes: {},
  fitScoreMin: null,
  fitScoreMax: null,
};

export const REVENUE_BUCKETS = [
  "<$1M",
  "$1M-$10M",
  "$10M-$50M",
  "$50M-$100M",
  "$100M-$500M",
  "$500M-$1B",
  "$1B+",
  "Unknown",
];

export const EMPLOYEE_RANGES = [
  { label: "1-50", min: 1, max: 50 },
  { label: "51-200", min: 51, max: 200 },
  { label: "201-500", min: 201, max: 500 },
  { label: "501-1,000", min: 501, max: 1000 },
  { label: "1,001-5,000", min: 1001, max: 5000 },
  { label: "5,000+", min: 5001, max: 999999 },
];

export const FIT_SCORE_RANGES = [
  { label: "A (70+)", min: 70, max: 100 },
  { label: "B (40-69)", min: 40, max: 69 },
  { label: "C (0-39)", min: 0, max: 39 },
];

export const PERSONAS = [
  "Business Decision Maker",
  "Business Influencer",
  "IT Decision Maker",
  "Technical Decision Maker",
  "Technical Influencer",
  "End User",
];

export const LEVELS = [
  "C-Level",
  "VP",
  "Director",
  "Manager",
  "Individual Contributor",
];

export function useListBuilder() {
  const { dataOrgId, effectiveOrgId } = useDataOrgId();
  const [filters, setFilters] = useState<ListBuilderFilters>(EMPTY_FILTERS);
  const [searchTriggered, setSearchTriggered] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pageSize = 50;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["list-builder", dataOrgId, effectiveOrgId, filters, page],
    queryFn: async () => {
      if (!dataOrgId) return { results: [], total: 0 };

      const { data, error } = await callCustomRpc<ListBuilderResult[]>("search_list_builder", {
        p_org_id: dataOrgId,
        p_industries: filters.industries.length > 0 ? filters.industries : null,
        p_revenue_buckets: filters.revenueBuckets.length > 0 ? filters.revenueBuckets : null,
        p_employee_min: filters.employeeMin,
        p_employee_max: filters.employeeMax,
        p_countries: filters.countries.length > 0 ? filters.countries : null,
        p_states: filters.states.length > 0 ? filters.states : null,
        p_cities: filters.cities.length > 0 ? filters.cities : null,
        p_business_models: filters.businessModels.length > 0 ? filters.businessModels : null,
        p_title_keywords: filters.titleKeywords || null,
        p_personas: filters.personas.length > 0 ? filters.personas : null,
        p_levels: filters.levels.length > 0 ? filters.levels : null,
        p_has_email: filters.hasEmail,
        p_has_phone: filters.hasPhone,
        p_custom_attributes: Object.keys(filters.customAttributes).length > 0 ? filters.customAttributes : null,
        p_page_offset: page * pageSize,
        p_page_limit: pageSize,
        p_score_org_id: effectiveOrgId !== dataOrgId ? effectiveOrgId : null,
        p_fit_score_min: filters.fitScoreMin,
        p_fit_score_max: filters.fitScoreMax,
      });

      if (error) throw error;

      const results = (data || []) as ListBuilderResult[];
      const total = results.length > 0 ? results[0].total_accounts : 0;
      return { results, total };
    },
    enabled: searchTriggered && !!dataOrgId,
  });

  const search = useCallback(() => {
    setPage(0);
    setSelectedIds(new Set());
    setSearchTriggered(true);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setSearchTriggered(false);
    setSelectedIds(new Set());
    setPage(0);
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (!data?.results) return;
    setSelectedIds(new Set(data.results.map((r) => r.account_id)));
  }, [data]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const exportCsv = useCallback(() => {
    if (!data?.results) return;
    const rows = data.results.filter(
      (r) => selectedIds.size === 0 || selectedIds.has(r.account_id)
    );
    const headers = [
      "Company",
      "Industry",
      "Revenue",
      "Employees",
      "Country",
      "State",
      "City",
      "Domain",
      "Business Model",
      "ICP Qualified",
      "Lead Count",
      "Fit Score",
      "Overall Score",
      "Intent Score",
    ];
    const csvRows = [
      headers.join(","),
      ...rows.map((r) =>
        [
          `"${(r.account_name || "").replace(/"/g, '""')}"`,
          `"${r.industry || ""}"`,
          `"${r.revenue_range || ""}"`,
          r.employee_count || "",
          `"${r.country || ""}"`,
          `"${r.state_province || ""}"`,
          `"${r.city || ""}"`,
          `"${r.domain || ""}"`,
          `"${r.business_model || ""}"`,
          r.icp_qualified ? "Yes" : "No",
          r.lead_count,
          r.fit_score || 0,
          r.overall_score || 0,
          r.intent_score || 0,
        ].join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `list-builder-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} accounts to CSV`);
  }, [data, selectedIds]);

  return {
    filters,
    setFilters,
    results: data?.results || [],
    totalAccounts: data?.total || 0,
    isLoading: isLoading || isFetching,
    search,
    resetFilters,
    page,
    setPage,
    pageSize,
    selectedIds,
    toggleSelect,
    selectAll,
    clearSelection,
    exportCsv,
    searchTriggered,
  };
}
