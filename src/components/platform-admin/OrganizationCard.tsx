import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Users, Database, Mail, Target, Activity } from "lucide-react";
import { OrganizationMetrics } from "@/hooks/use-platform-admin";
import { formatDistanceToNow } from "date-fns";

interface OrganizationCardProps {
  org: OrganizationMetrics;
  onManage: (orgId: string) => void;
}

export const OrganizationCard = ({ org, onManage }: OrganizationCardProps) => {
  const creditUsagePercent = (org.enrichment_credits_used / org.enrichment_credits_total) * 100;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <CardTitle>{org.name}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Created {formatDistanceToNow(new Date(org.created_at))} ago
              </p>
            </div>
          </div>
          <Badge variant={org.status === 'active' ? 'default' : 'secondary'}>
            {org.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <strong>{org.total_users}</strong> users
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <strong>{org.total_accounts}</strong> accounts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <strong>{org.total_contacts}</strong> contacts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <strong>{org.total_icps}</strong> ICPs
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Credit Usage</span>
            <span className="font-medium">
              {org.enrichment_credits_used} / {org.enrichment_credits_total}
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all" 
              style={{ width: `${Math.min(creditUsagePercent, 100)}%` }}
            />
          </div>
        </div>

        {org.last_activity && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>
              Last activity {formatDistanceToNow(new Date(org.last_activity))} ago
            </span>
          </div>
        )}

        <Button onClick={() => onManage(org.id)} className="w-full">
          Manage Organization
        </Button>
      </CardContent>
    </Card>
  );
};
