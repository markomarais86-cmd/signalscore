import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, Building2, Target, Users, Route, Megaphone, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { OnboardingStepCompany } from "@/components/admin/OnboardingStepCompany";
import { OnboardingStepICP } from "@/components/admin/OnboardingStepICP";
import { OnboardingStepTeam } from "@/components/admin/OnboardingStepTeam";
import { OnboardingStepRouting } from "@/components/admin/OnboardingStepRouting";
import { OnboardingStepCampaigns } from "@/components/admin/OnboardingStepCampaigns";
import { OnboardingStepReview } from "@/components/admin/OnboardingStepReview";

const steps = [
  { label: "Company", icon: Building2 },
  { label: "ICP", icon: Target },
  { label: "Team", icon: Users },
  { label: "Routing", icon: Route },
  { label: "Campaigns", icon: Megaphone },
  { label: "Review", icon: Rocket },
];

export default function CustomerOnboarding() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(0);

  // Fetch org list for new onboarding (pick org) or load existing config
  const { data: config, isLoading } = useQuery({
    queryKey: ["onboarding-config", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("org_onboarding_config")
        .select("*")
        .eq("org_id", orgId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  const { data: org } = useQuery({
    queryKey: ["org", orgId],
    queryFn: async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!orgId,
  });

  // Upsert config mutation
  const upsertConfig = useMutation({
    mutationFn: async (values: Record<string, unknown>) => {
      const { error } = await supabase
        .from("org_onboarding_config")
        .upsert({ org_id: orgId, ...values }, { onConflict: "org_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["onboarding-config", orgId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("org_onboarding_config")
        .update({ onboarding_status: "active", launched_at: new Date().toISOString() })
        .eq("org_id", orgId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer activated!");
      queryClient.invalidateQueries({ queryKey: ["onboarding-config"] });
      navigate("/admin/customer-onboarding");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (!orgId) {
    return <CustomerOrgPicker />;
  }

  if (isLoading) {
    return <div className="p-8 text-muted-foreground">Loading...</div>;
  }

  const StepComponent = [
    OnboardingStepCompany,
    OnboardingStepICP,
    OnboardingStepTeam,
    OnboardingStepRouting,
    OnboardingStepCampaigns,
    OnboardingStepReview,
  ][currentStep];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/customer-onboarding")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Customer Onboarding</h1>
          <p className="text-muted-foreground">{org?.name || "New Customer"}</p>
        </div>
        {config?.onboarding_status && (
          <Badge variant={config.onboarding_status === "active" ? "default" : "secondary"}>
            {config.onboarding_status}
          </Badge>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <button
            key={step.label}
            onClick={() => setCurrentStep(i)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
              i === currentStep
                ? "bg-primary text-primary-foreground"
                : i < currentStep
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {i < currentStep ? (
              <Check className="h-4 w-4" />
            ) : (
              <step.icon className="h-4 w-4" />
            )}
            <span className="hidden sm:inline">{step.label}</span>
          </button>
        ))}
      </div>

      {/* Step content */}
      <Card>
        <CardContent className="pt-6">
          <StepComponent
            orgId={orgId!}
            config={config}
            onSave={(values: Record<string, unknown>) => upsertConfig.mutateAsync(values)}
            onActivate={() => activateMutation.mutateAsync()}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        {currentStep < steps.length - 1 && (
          <Button onClick={() => setCurrentStep(currentStep + 1)}>
            Next
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </div>
  );
}

function CustomerOrgPicker() {
  const navigate = useNavigate();
  const { data: orgs, isLoading } = useQuery({
    queryKey: ["all-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: configs } = useQuery({
    queryKey: ["all-onboarding-configs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("org_onboarding_config").select("*");
      if (error) throw error;
      return data;
    },
  });

  const configMap = new Map(configs?.map((c) => [c.org_id, c]) || []);

  if (isLoading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Customer Onboarding</h1>
        <p className="text-muted-foreground">Manage your customers' demand engine setup</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {orgs?.map((org) => {
          const cfg = configMap.get(org.id);
          return (
            <Card
              key={org.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => navigate(`/admin/customer-onboarding/${org.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{org.name}</CardTitle>
                  <Badge
                    variant={
                      cfg?.onboarding_status === "active"
                        ? "default"
                        : cfg?.onboarding_status === "paused"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {cfg?.onboarding_status || "Not started"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground space-y-1">
                  {cfg?.company_name && <p>{cfg.company_name}</p>}
                  {cfg?.monthly_lead_target && (
                    <p>Target: {cfg.monthly_lead_target} leads/mo</p>
                  )}
                  {!cfg && <p>Click to start onboarding</p>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
