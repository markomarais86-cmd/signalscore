import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useDataOrgId } from "@/hooks/use-data-org";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Loader2, Users, Mail, Star, Sparkles, Database } from "lucide-react";
import { toast } from "sonner";
import { LargeExportDialog } from "./LargeExportDialog";

type ExportFilter = "all" | "with_email" | "high_fit" | "discovered" | "all_full";

const LARGE_EXPORT_THRESHOLD = 5000;

export function ExportLeadsButton() {
  const { userProfile, user } = useAuth();
  const { dataOrgId, effectiveOrgId } = useDataOrgId();
  const [exporting, setExporting] = useState(false);
  const [showLargeExportDialog, setShowLargeExportDialog] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<ExportFilter>("all");
  const [recordCount, setRecordCount] = useState(0);

  const checkCountAndExport = async (filter: ExportFilter) => {
    if (!dataOrgId) return;

    try {
      setExporting(true);

      // Check count first
      let query = supabase
        .from("Leads")
        .select("id", { count: "exact", head: true })
        .eq("org_id", dataOrgId);

      if (filter === "with_email") {
        query = query.not("email", "is", null);
      } else if (filter === "discovered") {
        query = query.eq("enrichment_source", "ai_discovered");
      }
      // Note: high_fit filter requires a join, so we handle it differently

      const { count, error } = await query;

      if (error) throw error;

      const totalCount = count || 0;

      if (totalCount === 0) {
        toast.warning("No leads to export");
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
        await exportLeadsClientSide(filter);
      }
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to prepare export");
      setExporting(false);
    }
  };

  const exportLeadsClientSide = async (filter: ExportFilter) => {
    if (!dataOrgId) return;

    try {
      setExporting(true);
      toast.info("Preparing leads export...");

      let query = supabase
        .from("Leads")
        .select(`
          external_id,
          contact_external_id,
          account_external_id,
          name,
          first_name,
          last_name,
          title,
          title_raw,
          level,
          persona,
          email,
          email_status,
          email_verified,
          email_verified_at,
          email_verification_status,
          phone,
          mobile,
          cell_phone,
          direct_phone,
          phone_extension,
          phone_type,
          phone_e164,
          phone_verified,
          phone_verification_status,
          verified_phone,
          verified_email,
          company,
          website,
          industry,
          sub_industry,
          country,
          state_province,
          location_city,
          location_region,
          timezone,
          employee_count,
          revenue_range,
          company_hq_address,
          company_hq_city,
          company_hq_state,
          company_hq_country,
          company_hq_postal_code,
          company_main_phone,
          company_sic_code,
          company_naics_code,
          linkedin_url,
          twitter_url,
          facebook_url,
          company_facebook_url,
          status,
          pipeline_stage,
          pipeline_updated_at,
          pipeline_triggered_by,
          icp_qualified,
          icp_fail_reasons,
          priority_rank,
          export_eligible,
          enrichment_source,
          enriched_at,
          enriched_from,
          enrichment_pass,
          enrichment_confidence,
          enrichment_overall_score,
          enrichment_field_scores,
          enrichment_total_score,
          enrichment_max_score,
          enrichment_citations,
          data_source,
          source_type,
          discovered_at,
          discovered_from_account,
          external_database_match,
          match_confidence,
          match_reasoning,
          consent_status,
          suppression_reason,
          previous_company,
          previous_title,
          still_at_company,
          title_as_of,
          last_exported_at,
          deep_research_completed_at,
          created_at,
          updated_at
        `)
        .eq("org_id", dataOrgId);

      // Apply filter
      if (filter === "with_email") {
        query = query.not("email", "is", null);
      } else if (filter === "high_fit") {
        // Get high-fit account IDs first
        const { data: highFitAccounts } = await supabase
          .from("scores")
          .select("account_external_id")
          .eq("org_id", effectiveOrgId)
          .gte("overall_score", 70);

        const accountIds = highFitAccounts?.map(a => a.account_external_id) || [];
        if (accountIds.length > 0) {
          query = query.in("account_external_id", accountIds);
        } else {
          toast.warning("No high-fit accounts found");
          setExporting(false);
          return;
        }
      } else if (filter === "discovered") {
        query = query.eq("enrichment_source", "ai_discovered");
      }

      const { data: leads, error } = await query.order("company");

      if (error) throw error;

      if (!leads || leads.length === 0) {
        toast.warning("No leads to export");
        return;
      }

      // Full headers for all fields
      const headers = [
        "External ID", "Contact External ID", "Account External ID", "Name",
        "First Name", "Last Name", "Title", "Title Raw", "Level", "Persona",
        "Email", "Email Status", "Email Verified", "Email Verified At",
        "Email Verification Status", "Phone", "Mobile", "Cell Phone", "Direct Phone",
        "Phone Extension", "Phone Type", "Phone Verified", "Phone Verification Status",
        "Verified Phone", "Verified Email", "Company", "Website", "Industry",
        "Sub Industry", "Country", "State/Province", "Location City", "Location Region",
        "Timezone", "Employee Count", "Revenue Range", "Company HQ Address",
        "Company HQ City", "Company HQ State", "Company HQ Country", "Company HQ Postal Code",
        "Company Main Phone", "Company SIC Code", "Company NAICS Code", "LinkedIn URL",
        "Twitter URL", "Facebook URL", "Company Facebook URL", "Status", "Pipeline Stage",
        "Pipeline Updated At", "Pipeline Triggered By", "ICP Qualified", "ICP Fail Reasons",
        "Priority Rank", "Export Eligible", "Enrichment Source", "Enriched At",
        "Enriched From", "Enrichment Pass", "Enrichment Confidence", "Enrichment Overall Score",
        "Enrichment Field Scores", "Enrichment Total Score", "Enrichment Max Score",
        "Enrichment Citations", "Data Source", "Source Type", "Discovered At",
        "Discovered From Account", "External Database Match", "Match Confidence",
        "Match Reasoning", "Consent Status", "Suppression Reason", "Previous Company",
        "Previous Title", "Still At Company", "Title As Of", "Last Exported At",
        "Deep Research Completed At", "Created At", "Updated At",
      ];

      const csvRows = [headers.join(",")];

      for (const lead of leads as any[]) {
        const row = [
          lead.external_id || "",
          lead.contact_external_id || "",
          lead.account_external_id || "",
          escapeCsv(lead.name || ""),
          escapeCsv(lead.first_name || ""),
          escapeCsv(lead.last_name || ""),
          escapeCsv(lead.title || ""),
          escapeCsv(lead.title_raw || ""),
          lead.level || "",
          lead.persona || "",
          lead.email || "",
          lead.email_status || "",
          lead.email_verified?.toString() || "",
          lead.email_verified_at || "",
          lead.email_verification_status || "",
          lead.phone || "",
          lead.mobile || "",
          lead.cell_phone || "",
          lead.direct_phone || "",
          lead.phone_extension || "",
          lead.phone_type || "",
          lead.phone_verified?.toString() || "",
          lead.phone_verification_status || "",
          lead.verified_phone || "",
          lead.verified_email || "",
          escapeCsv(lead.company || ""),
          lead.website || "",
          escapeCsv(lead.industry || ""),
          escapeCsv(lead.sub_industry || ""),
          lead.country || "",
          lead.state_province || "",
          lead.location_city || "",
          lead.location_region || "",
          lead.timezone || "",
          lead.employee_count?.toString() || "",
          escapeCsv(lead.revenue_range || ""),
          escapeCsv(lead.company_hq_address || ""),
          lead.company_hq_city || "",
          lead.company_hq_state || "",
          lead.company_hq_country || "",
          lead.company_hq_postal_code || "",
          lead.company_main_phone || "",
          lead.company_sic_code || "",
          lead.company_naics_code || "",
          lead.linkedin_url || "",
          lead.twitter_url || "",
          lead.facebook_url || "",
          lead.company_facebook_url || "",
          lead.status || "",
          lead.pipeline_stage || "",
          lead.pipeline_updated_at || "",
          lead.pipeline_triggered_by || "",
          lead.icp_qualified?.toString() || "",
          Array.isArray(lead.icp_fail_reasons) ? escapeCsv(lead.icp_fail_reasons.join("; ")) : "",
          lead.priority_rank?.toString() || "",
          lead.export_eligible?.toString() || "",
          lead.enrichment_source || "",
          lead.enriched_at || "",
          lead.enriched_from || "",
          lead.enrichment_pass?.toString() || "",
          lead.enrichment_confidence?.toString() || "",
          lead.enrichment_overall_score?.toString() || "",
          lead.enrichment_field_scores ? escapeCsv(JSON.stringify(lead.enrichment_field_scores)) : "",
          lead.enrichment_total_score?.toString() || "",
          lead.enrichment_max_score?.toString() || "",
          lead.enrichment_citations ? escapeCsv(JSON.stringify(lead.enrichment_citations)) : "",
          lead.data_source || "",
          lead.source_type || "",
          lead.discovered_at || "",
          lead.discovered_from_account?.toString() || "",
          lead.external_database_match?.toString() || "",
          lead.match_confidence?.toString() || "",
          escapeCsv(lead.match_reasoning || ""),
          lead.consent_status || "",
          lead.suppression_reason || "",
          escapeCsv(lead.previous_company || ""),
          escapeCsv(lead.previous_title || ""),
          lead.still_at_company?.toString() || "",
          lead.title_as_of || "",
          lead.last_exported_at || "",
          lead.deep_research_completed_at || "",
          lead.created_at || "",
          lead.updated_at || "",
        ];
        csvRows.push(row.join(","));
      }

      const csvContent = csvRows.join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `leads_export_${filter}_${new Date().toISOString().split("T")[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${leads.length} leads with ${headers.length} fields!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export leads");
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
          export_type: "leads",
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
    exportLeadsClientSide(pendingFilter);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" disabled={exporting}>
            {exporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Users className="h-4 w-4 mr-2" />
            )}
            Export Leads
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => checkCountAndExport("all")}>
            <Download className="h-4 w-4 mr-2" />
            Export All Leads
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => checkCountAndExport("with_email")}>
            <Mail className="h-4 w-4 mr-2" />
            Export With Email Only
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => checkCountAndExport("high_fit")}>
            <Star className="h-4 w-4 mr-2" />
            Export at High-Fit Accounts (70+)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => checkCountAndExport("discovered")}>
            <Sparkles className="h-4 w-4 mr-2" />
            Export AI Discovered Only
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => checkCountAndExport("all_full")}>
            <Database className="h-4 w-4 mr-2" />
            Export Full Data (85 Fields)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <LargeExportDialog
        open={showLargeExportDialog}
        onOpenChange={setShowLargeExportDialog}
        recordCount={recordCount}
        exportType="leads"
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
