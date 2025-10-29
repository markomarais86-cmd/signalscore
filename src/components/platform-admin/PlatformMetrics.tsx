import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Database, TrendingUp } from "lucide-react";
import { OrganizationMetrics } from "@/hooks/use-platform-admin";

interface PlatformMetricsProps {
  organizations: OrganizationMetrics[];
}

export const PlatformMetrics = ({ organizations }: PlatformMetricsProps) => {
  const totalUsers = organizations.reduce((sum, org) => sum + org.total_users, 0);
  const totalAccounts = organizations.reduce((sum, org) => sum + org.total_accounts, 0);
  const totalContacts = organizations.reduce((sum, org) => sum + org.total_contacts, 0);
  const activeOrgs = organizations.filter(org => org.status === 'active').length;

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
