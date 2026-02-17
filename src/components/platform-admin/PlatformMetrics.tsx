import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Database, TrendingUp, Zap, Activity } from "lucide-react";
import { OrganizationMetrics } from "@/hooks/use-platform-admin";
import { supabase } from "@/integrations/supabase/client";

interface PlatformMetricsProps {
  organizations: OrganizationMetrics[];
}

export const PlatformMetrics = ({ organizations }: PlatformMetricsProps) => {
  const totalUsers = organizations.reduce((sum, org) => sum + org.total_users, 0);
  const totalAccounts = organizations.reduce((sum, org) => sum + org.total_accounts, 0);
  const totalContacts = organizations.reduce((sum, org) => sum + org.total_contacts, 0);
  const activeOrgs = organizations.filter(org => org.status === 'active').length;

  const [activeEnrichmentJobs, setActiveEnrichmentJobs] = useState(0);
  const [edgeFunctionHealth, setEdgeFunctionHealth] = useState<string>("checking...");

  useEffect(() => {
    const fetchExtras = async () => {
      // Active enrichment jobs
      const { count } = await supabase
        .from("enrichment_jobs")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "processing"]);
      setActiveEnrichmentJobs(count || 0);

      // Edge function health
      try {
        const { data, error } = await supabase.functions.invoke("health-check");
        if (error) {
          setEdgeFunctionHealth("error");
        } else {
          setEdgeFunctionHealth(data?.status || "unknown");
        }
      } catch {
        setEdgeFunctionHealth("error");
      }
    };
    fetchExtras();
  }, []);

  const metrics = [
    {
      title: "Total Organizations",
      value: organizations.length,
      active: activeOrgs,
      icon: Building2,
      color: "text-blue-600"
    },
    {
      title: "Total Users",
      value: totalUsers,
      subtitle: "across all orgs",
      icon: Users,
      color: "text-green-600"
    },
    {
      title: "Total Accounts",
      value: totalAccounts.toLocaleString(),
      subtitle: "managed accounts",
      icon: Database,
      color: "text-purple-600"
    },
    {
      title: "Total Contacts",
      value: totalContacts.toLocaleString(),
      subtitle: "contact records",
      icon: TrendingUp,
      color: "text-orange-600"
    },
    {
      title: "Active Enrichment Jobs",
      value: activeEnrichmentJobs,
      subtitle: "pending or processing",
      icon: Zap,
      color: "text-yellow-600"
    },
    {
      title: "Edge Function Health",
      value: edgeFunctionHealth === "healthy" ? "✓ Healthy" : edgeFunctionHealth === "degraded" ? "⚠ Degraded" : edgeFunctionHealth === "checking..." ? "..." : "✗ Error",
      subtitle: "platform status",
      icon: Activity,
      color: edgeFunctionHealth === "healthy" ? "text-green-600" : edgeFunctionHealth === "degraded" ? "text-yellow-600" : "text-red-600"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            <metric.icon className={`h-4 w-4 ${metric.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            {metric.active !== undefined ? (
              <p className="text-xs text-muted-foreground">
                {metric.active} active
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">{metric.subtitle}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
