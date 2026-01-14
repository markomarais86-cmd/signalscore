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
import { Download, Loader2, Users, Mail, Star, Sparkles } from "lucide-react";
import { toast } from "sonner";

type ExportFilter = "all" | "with_email" | "high_fit" | "discovered";

export function ExportLeadsButton() {
  const { userProfile } = useAuth();
  const [exporting, setExporting] = useState(false);

  const exportLeads = async (filter: ExportFilter) => {
    if (!userProfile?.org_id) return;

    try {
      setExporting(true);
      toast.info("Preparing leads export...");

      let query = supabase
        .from("Leads")
        .select(`
          external_id,
          name,
          first_name,
          last_name,
          email,
          phone,
          mobile,
          title,
          company,
          account_external_id,
          industry,
          country,
          state_province,
          employee_count,
          revenue_range,
          status,
          enrichment_source,
          created_at,
          updated_at
        `)
        .eq("org_id", userProfile.org_id);

      // Apply filter
      if (filter === "with_email") {
        query = query.not("email", "is", null);
      } else if (filter === "high_fit") {
        // Get high-fit account IDs first
        const { data: highFitAccounts } = await supabase
          .from("scores")
          .select("account_external_id")
          .eq("org_id", userProfile.org_id)
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

      // Convert to CSV
      const headers = [
        "External ID",
        "Name",
        "First Name",
        "Last Name",
        "Email",
        "Phone",
        "Mobile",
        "Title",
        "Company",
        "Account ID",
        "Industry",
        "Country",
        "State/Province",
        "Employee Count",
        "Revenue Range",
        "Status",
        "Source",
        "Created At",
        "Updated At",
      ];

      const csvRows = [headers.join(",")];

      for (const lead of leads as any[]) {
        const row = [
          lead.external_id || "",
          escapeCsv(lead.name || ""),
          escapeCsv(lead.first_name || ""),
          escapeCsv(lead.last_name || ""),
          lead.email || "",
          lead.phone || "",
          lead.mobile || "",
          escapeCsv(lead.title || ""),
          escapeCsv(lead.company || ""),
          lead.account_external_id || "",
          escapeCsv(lead.industry || ""),
          lead.country || "",
          lead.state_province || "",
          lead.employee_count?.toString() || "",
          escapeCsv(lead.revenue_range || ""),
          lead.status || "",
          lead.enrichment_source || "",
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

      toast.success(`Exported ${leads.length} leads!`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export leads");
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
            <Users className="h-4 w-4 mr-2" />
          )}
          Export Leads
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => exportLeads("all")}>
          <Download className="h-4 w-4 mr-2" />
          Export All Leads
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportLeads("with_email")}>
          <Mail className="h-4 w-4 mr-2" />
          Export With Email Only
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => exportLeads("high_fit")}>
          <Star className="h-4 w-4 mr-2" />
          Export at High-Fit Accounts (70+)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportLeads("discovered")}>
          <Sparkles className="h-4 w-4 mr-2" />
          Export AI Discovered Only
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
