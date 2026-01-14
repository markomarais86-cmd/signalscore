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
import { Download, Loader2, FileSpreadsheet, CheckCircle } from "lucide-react";
import { toast } from "sonner";

type ExportFilter = "all" | "enriched" | "high_score";

export function ExportAccountsButton() {
  const { userProfile } = useAuth();
  const [exporting, setExporting] = useState(false);

  const exportAccounts = async (filter: ExportFilter) => {
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
          industry_norm,
          industry_raw,
          employee_count,
          revenue_range,
          country,
          state_province,
          city,
          linkedin_url,
          twitter_url,
          facebook_url,
          phone,
          hq_address,
          founded_year,
          business_model,
          tech_stack,
          total_raised_usd,
          last_funding_round,
          propensity_score,
          icp_qualified,
          enriched_at,
          enrichment_confidence
        `)
        .eq("org_id", userProfile.org_id);

      // Apply filter
      if (filter === "enriched") {
        query = query.not("enriched_at", "is", null);
      } else if (filter === "high_score") {
        query = query.gte("propensity_score", 70);
      }

      const { data: accounts, error } = await query.order("name");

      if (error) throw error;

      if (!accounts || accounts.length === 0) {
        toast.warning("No accounts to export");
        return;
      }

      // Convert to CSV
      const headers = [
        "External ID",
        "Name",
        "Domain",
        "Industry",
        "Industry Raw",
        "Employee Count",
        "Revenue Range",
        "Country",
        "State/Province",
        "City",
        "LinkedIn URL",
        "Twitter URL",
        "Facebook URL",
        "Phone",
        "HQ Address",
        "Founded Year",
        "Business Model",
        "Tech Stack",
        "Total Raised USD",
        "Last Funding Round",
        "Propensity Score",
        "ICP Qualified",
        "Enriched At",
        "Enrichment Confidence",
      ];

      const csvRows = [headers.join(",")];

      for (const acc of accounts) {
        const row = [
          acc.external_id || "",
          escapeCsv(acc.name || ""),
          acc.domain || "",
          escapeCsv(acc.industry_norm || ""),
          escapeCsv(acc.industry_raw || ""),
          acc.employee_count?.toString() || "",
          escapeCsv(acc.revenue_range || ""),
          acc.country || "",
          acc.state_province || "",
          acc.city || "",
          acc.linkedin_url || "",
          acc.twitter_url || "",
          acc.facebook_url || "",
          acc.phone || "",
          escapeCsv(acc.hq_address || ""),
          acc.founded_year?.toString() || "",
          acc.business_model || "",
          Array.isArray(acc.tech_stack) ? escapeCsv(acc.tech_stack.join("; ")) : "",
          acc.total_raised_usd?.toString() || "",
          acc.last_funding_round || "",
          acc.propensity_score?.toString() || "",
          acc.icp_qualified?.toString() || "",
          acc.enriched_at || "",
          acc.enrichment_confidence?.toString() || "",
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

      toast.success(`Exported ${accounts.length} accounts!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export accounts");
    } finally {
      setExporting(false);
    }
  };

  return (
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
        <DropdownMenuItem onClick={() => exportAccounts("all")}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export All Accounts
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportAccounts("enriched")}>
          <CheckCircle className="h-4 w-4 mr-2" />
          Export Enriched Only
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportAccounts("high_score")}>
          <Download className="h-4 w-4 mr-2" />
          Export High-Fit (70+)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function escapeCsv(str: string): string {
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
