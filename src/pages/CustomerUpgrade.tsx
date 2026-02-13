import { CUSTOMER_PLAN_TIERS } from "@/lib/plan-tiers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check } from "lucide-react";
import { toast } from "sonner";

export default function CustomerUpgrade() {
  const handleSelect = (planId: string) => {
    toast.info(`To upgrade to ${planId}, please contact your LaunchPulse account manager.`);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Upgrade to Self-Service</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Take full control of your demand engine. Upload data, build ICPs, run scoring, and manage campaigns — all from your dashboard.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {CUSTOMER_PLAN_TIERS.map((tier) => (
          <Card
            key={tier.id}
            className={tier.id === "growth" ? "border-primary shadow-lg" : ""}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{tier.displayName}</CardTitle>
                {tier.id === "growth" && (
                  <Badge variant="default" className="text-xs">Popular</Badge>
                )}
              </div>
              <p className="text-2xl font-bold">
                {tier.monthlyPrice
                  ? `$${tier.monthlyPrice.toLocaleString()}`
                  : "Custom"}
                {tier.monthlyPrice && (
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                )}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-sm">
                <PlanFeature
                  label={`${tier.limits.maxAccounts?.toLocaleString() ?? "Unlimited"} accounts`}
                />
                <PlanFeature
                  label={`${tier.limits.maxUsers?.toLocaleString() ?? "Unlimited"} users`}
                />
                <PlanFeature
                  label={`${tier.monthlyEnrichmentCredits.toLocaleString()} credits/mo`}
                />
                {tier.features.crmSync && <PlanFeature label="CRM Sync" />}
                {tier.features.apiAccess && <PlanFeature label="API Access" />}
                {tier.features.sso && <PlanFeature label="SSO" />}
                {tier.features.customReporting && <PlanFeature label="Custom Reporting" />}
              </ul>
              <Button
                className="w-full"
                variant={tier.id === "growth" ? "default" : "outline"}
                onClick={() => handleSelect(tier.displayName)}
              >
                {tier.monthlyPrice ? "Contact Sales" : "Contact Sales"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PlanFeature({ label }: { label: string }) {
  return (
    <li className="flex items-center gap-2">
      <Check className="h-3 w-3 text-primary shrink-0" />
      <span>{label}</span>
    </li>
  );
}
