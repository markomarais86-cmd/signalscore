import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2, FileSpreadsheet, CheckCircle, Database } from "lucide-react";
import { toast } from "sonner";
import { LargeExportDialog } from "./LargeExportDialog";

type ExportFilter = "all" | "enriched" | "high_score" | "all_full";

const LARGE_EXPORT_THRESHOLD = 5000;

export function ExportAccountsButton() {
  const { userProfile, user } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [showLargeExportDialog, setShowLargeExportDialog] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<ExportFilter>("all");
  const [recordCount, setRecordCount] = useState(0);

  const checkCountAndExport = async (filter: ExportFilter) => {
    if (!userProfile?.org_id) return;

    try {
      setExporting(true);

      // Check count first
      let query = supabase
        .from("accounts")
        .select("id", { count: "exact", head: true })
        .eq("org_id", userProfile.org_id);

      if (filter === "enriched" || filter === "all_full") {
        if (filter === "enriched") {
          query = query.not("enriched_at", "is", null);
        }
      } else if (filter === "high_score") {
        query = query.gte("propensity_score", 70);
      }

      const { count, error } = await query;

      if (error) throw error;

      const totalCount = count || 0;

      if (totalCount === 0) {
        toast.warning("No accounts to export");
        setExporting(false);
        return;
      }

      if (totalCount > LARGE_EXPORT_THRESHOLD) {
        setRecordCount(totalCount);
        setPendingFilter(filter);
        setShowLargeExportDialog(true);
        setExporting(false);
      } else {
        // Proceed with client-side export
        await exportAccountsClientSide(filter);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to prepare export");
      setExporting(false);
    }
  };

  const exportAccountsClientSide = async (filter: ExportFilter) => {
    if (!userProfile?.org_id) return;

    try {
      setExporting(true);
      toast.info("Preparing export...");

      let query = supabase
        .from("accounts")
        .select(`
          external_id,
          name,
          domain,
          legal_name,
          industry_norm,
          industry_raw,
          sub_industry,
          sic_code,
          naics,
          employee_count,
          revenue_range,
          business_model,
          country,
          state_province,
          city,
          hq_address,
          hq_city,
          hq_state,
          hq_postal_code,
          phone,
          mobile,
          company_main_phone,
          linkedin_url,
          twitter_url,
          facebook_url,
          founded_year,
          total_raised_usd,
          last_funding_round,
          last_funding_date,
          tech_stack,
          trust_signals,
          propensity_score,
          propensity_computed_at,
          icp_qualified,
          icp_fail_reasons,
          enriched_at,
          enriched_from,
          enrichment_phase,
          enrichment_confidence,
          enrichment_overall_score,
          enrichment_field_scores,
          enrichment_citations,
          data_source,
          external_database_match,
          deep_research_requested,
          deep_research_completed_at,
          last_verified_at,
          manually_verified,
          updated_at
        `)
        .eq("org_id", userProfile.org_id);

      // Apply filter
      if (filter === "enriched" || filter === "all_full") {
        if (filter === "enriched") {
          query = query.not("enriched_at", "is", null);
        }
      } else if (filter === "high_score") {
        query = query.gte("propensity_score", 70);
      }

      const { data: accounts, error } = await query.order("name");

      if (error) throw error;

      if (!accounts || accounts.length === 0) {
        toast.warning("No accounts to export");
        return;
      }

      // Full headers for all fields
      const headers = [
        "External ID", "Name", "Domain", "Legal Name", "Industry", "Industry Raw",
        "Sub Industry", "SIC Code", "NAICS", "Employee Count", "Revenue Range",
        "Business Model", "Country", "State/Province", "City", "HQ Address",
        "HQ City", "HQ State", "HQ Postal Code", "Phone", "Mobile",
        "Company Main Phone", "LinkedIn URL", "Twitter URL", "Facebook URL",
        "Founded Year", "Total Raised USD", "Last Funding Round", "Last Funding Date",
        "Tech Stack", "Trust Signals", "Propensity Score", "Propensity Computed At",
        "ICP Qualified", "ICP Fail Reasons", "Enriched At", "Enriched From",
        "Enrichment Phase", "Enrichment Confidence", "Enrichment Overall Score",
        "Enrichment Field Scores", "Enrichment Citations", "Data Source",
        "External Database Match", "Deep Research Requested", "Deep Research Completed At",
        "Last Verified At", "Manually Verified", "Updated At",
      ];

      const csvRows = [headers.join(",")];

      for (const acc of accounts) {
        const row = [
          acc.external_id || "",
          escapeCsv(acc.name || ""),
          acc.domain || "",
          escapeCsv(acc.legal_name || ""),
          escapeCsv(acc.industry_norm || ""),
          escapeCsv(acc.industry_raw || ""),
          escapeCsv(acc.sub_industry || ""),
          acc.sic_code || "",
          acc.naics || "",
          acc.employee_count?.toString() || "",
          escapeCsv(acc.revenue_range || ""),
          acc.business_model || "",
          acc.country || "",
          acc.state_province || "",
          acc.city || "",
          escapeCsv(acc.hq_address || ""),
          acc.hq_city || "",
          acc.hq_state || "",
          acc.hq_postal_code || "",
          acc.phone || "",
          acc.mobile || "",
          acc.company_main_phone || "",
          acc.linkedin_url || "",
          acc.twitter_url || "",
          acc.facebook_url || "",
          acc.founded_year?.toString() || "",
          acc.total_raised_usd?.toString() || "",
          acc.last_funding_round || "",
          acc.last_funding_date || "",
          Array.isArray(acc.tech_stack) ? escapeCsv(acc.tech_stack.join("; ")) : "",
          acc.trust_signals ? escapeCsv(JSON.stringify(acc.trust_signals)) : "",
          acc.propensity_score?.toString() || "",
          acc.propensity_computed_at || "",
          acc.icp_qualified?.toString() || "",
          Array.isArray(acc.icp_fail_reasons) ? escapeCsv(acc.icp_fail_reasons.join("; ")) : "",
          acc.enriched_at || "",
          acc.enriched_from || "",
          acc.enrichment_phase || "",
          acc.enrichment_confidence?.toString() || "",
          acc.enrichment_overall_score?.toString() || "",
          acc.enrichment_field_scores ? escapeCsv(JSON.stringify(acc.enrichment_field_scores)) : "",
          acc.enrichment_citations ? escapeCsv(JSON.stringify(acc.enrichment_citations)) : "",
          acc.data_source || "",
          acc.external_database_match?.toString() || "",
          acc.deep_research_requested?.toString() || "",
          acc.deep_research_completed_at || "",
          acc.last_verified_at || "",
          acc.manually_verified ? escapeCsv(JSON.stringify(acc.manually_verified)) : "",
          acc.updated_at || "",
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `accounts_export_${filter}_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${accounts.length} accounts with ${headers.length} fields!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export accounts");
    } finally {
      setExporting(false);
    }
  };

  const startBackgroundExport = async () => {
    if (!userProfile?.org_id || !user?.id) return;

    try {
      setExporting(true);
      setShowLargeExportDialog(false);

      const { data, error } = await supabase.functions.invoke("export-csv", {
        body: {
          export_type: "accounts",
          filter: pendingFilter,
          org_id: userProfile.org_id,
          user_id: user.id,
        },
      });

      if (error) throw error;

      toast.success("Export started! You'll be notified when it's ready.", {
        description: "Check the export queue for progress.",
      });
    } catch (error) {
      console.error("Background export error:", error);
      toast.error("Failed to start background export");
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadNow = () => {
    setShowLargeExportDialog(false);
    exportAccountsClientSide(pendingFilter);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Export
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => checkCountAndExport("all")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export All Accounts
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => checkCountAndExport("enriched")}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Export Enriched Only
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => checkCountAndExport("high_score")}>
            <Download className="h-4 w-4 mr-2" />
            Export High-Fit (70+)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => checkCountAndExport("all_full")}>
            <Database className="h-4 w-4 mr-2" />
            Export Full Data (50 Fields)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LargeExportDialog
        open={showLargeExportDialog}
        onOpenChange={setShowLargeExportDialog}
        recordCount={recordCount}
        exportType="accounts"
        onDownloadNow={handleDownloadNow}
        onExportInBackground={startBackgroundExport}
        isExporting={exporting}
      />
    </>
  );
}

function escapeCsv(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
