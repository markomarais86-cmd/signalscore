import { CUSTOMER_PLAN_TIERS } from "@/lib/plan-tiers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, MessageSquare, Mail, ArrowRight } from "lucide-react";

export default function CustomerUpgrade() {
  const salesEmail = "sales@launchpulse.com";

  const handleContactSales = (planName?: string) => {
    const subject = planName
      ? `Upgrade inquiry — ${planName} plan`
      : "Upgrade inquiry";
    window.location.href = `mailto:${salesEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent("Hi LaunchPulse team,\n\nI'd like to learn more about upgrading my account.\n\nThanks!")}`;
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-8 px-4">
      {/* Hero */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">Upgrade to Self-Service</h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Take full control of your demand engine. Upload data, build ICPs, run scoring, and manage campaigns — all from your dashboard.
        </p>
      </div>

      {/* CTA Banner */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold">Ready to upgrade?</p>
              <p className="text-sm text-muted-foreground">
                Talk to our team to find the right plan for your organization.
              </p>
            </div>
          </div>
          <Button size="lg" onClick={() => handleContactSales()} className="shrink-0">
            <Mail className="h-4 w-4 mr-2" />
            Contact Sales
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {/* Plan Tiers */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {CUSTOMER_PLAN_TIERS.map((tier) => (
          <Card
            key={tier.id}
            className={tier.id === "growth" ? "border-primary shadow-lg relative" : ""}
          >
            {tier.id === "growth" && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="text-xs px-3">Most Popular</Badge>
              </div>
            )}
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{tier.displayName}</CardTitle>
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
                onClick={() => handleContactSales(tier.displayName)}
              >
                Contact Sales
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-center text-xs text-muted-foreground">
        All plans include onboarding support. Annual billing available with discounts.
      </p>
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
