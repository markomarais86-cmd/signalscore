import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { trackDemoRequest } from "@/lib/analytics";
import { useTrackingParams } from "@/hooks/useUTMParams";
import { CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { PhoneVerificationStep } from "./PhoneVerificationStep";

const QUIZ_STEPS = [
  {
    id: "company_size",
    question: "How large is your sales team?",
    options: [
      { value: "1-10", label: "1–10 reps" },
      { value: "11-50", label: "11–50 reps" },
      { value: "51-200", label: "51–200 reps" },
      { value: "200+", label: "200+ reps" },
    ],
  },
  {
    id: "industry",
    question: "What industry are you in?",
    options: [
      { value: "saas", label: "SaaS / Software" },
      { value: "fintech", label: "Fintech / Financial Services" },
      { value: "healthcare", label: "Healthcare / Life Sciences" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "current_tools",
    question: "What CRM do you currently use?",
    options: [
      { value: "salesforce", label: "Salesforce" },
      { value: "hubspot", label: "HubSpot" },
      { value: "other_crm", label: "Other CRM" },
      { value: "none", label: "No CRM yet" },
    ],
  },
  {
    id: "budget_range",
    question: "What's your estimated GTM tools budget?",
    options: [
      { value: "under_1k", label: "Under $1K/mo" },
      { value: "1k_5k", label: "$1K–$5K/mo" },
      { value: "5k_20k", label: "$5K–$20K/mo" },
      { value: "20k_plus", label: "$20K+/mo" },
    ],
  },
  {
    id: "timeline",
    question: "When are you looking to get started?",
    options: [
      { value: "immediately", label: "Immediately" },
      { value: "1_3_months", label: "1–3 months" },
      { value: "3_6_months", label: "3–6 months" },
      { value: "exploring", label: "Just exploring" },
    ],
  },
];

function calculateScore(answers: Record<string, string>): number {
  let score = 0;
  const sizeMap: Record<string, number> = { "1-10": 10, "11-50": 20, "51-200": 30, "200+": 25 };
  score += sizeMap[answers.company_size] || 0;
  const budgetMap: Record<string, number> = { under_1k: 5, "1k_5k": 15, "5k_20k": 25, "20k_plus": 30 };
  score += budgetMap[answers.budget_range] || 0;
  const timelineMap: Record<string, number> = { immediately: 30, "1_3_months": 20, "3_6_months": 10, exploring: 5 };
  score += timelineMap[answers.timeline] || 0;
  const crmMap: Record<string, number> = { salesforce: 10, hubspot: 10, other_crm: 5, none: 0 };
  score += crmMap[answers.current_tools] || 0;
  return score;
}

interface QuizBrandConfig {
  primaryColor?: string;
}

interface QuizFunnelProps {
  source?: string;
  onComplete?: () => void;
  brandConfig?: QuizBrandConfig;
}

export function QuizFunnel({ source = "quiz-funnel", onComplete, brandConfig }: QuizFunnelProps) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [contactInfo, setContactInfo] = useState({ name: "", email: "", company: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { utmParams, clickIds, funnelVariant } = useTrackingParams();

  const [phoneVerified, setPhoneVerified] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);

  const totalSteps = QUIZ_STEPS.length + 2; // quiz + contact + phone
  const isContactStep = step === QUIZ_STEPS.length;
  const isPhoneStep = step === QUIZ_STEPS.length + 1;
  const currentQuiz = QUIZ_STEPS[step];
  const progress = ((step + 1) / totalSteps) * 100;

  const selectAnswer = (value: string) => {
    if (!currentQuiz) return;
    setAnswers((prev) => ({ ...prev, [currentQuiz.id]: value }));
    setTimeout(() => setStep((s) => s + 1), 300);
  };

  const handleContactSubmit = async () => {
    if (!contactInfo.name || !contactInfo.email) {
      toast.error("Please fill in your name and email.");
      return;
    }
    setIsSubmitting(true);
    try {
      const qualificationScore = calculateScore(answers);

      const { data, error } = await supabase.functions.invoke("demo-request", {
        body: {
          ...contactInfo,
          source,
          ...utmParams,
          click_ids: clickIds,
          funnel_variant: funnelVariant,
          quiz_answers: answers,
          qualification_score: qualificationScore,
        },
      });

      if (error) throw error;

      await supabase.from("quiz_responses" as any).insert({
        email: contactInfo.email,
        answers,
        qualification_score: qualificationScore,
        company_size: answers.company_size,
        industry: answers.industry,
        current_tools: answers.current_tools,
        budget_range: answers.budget_range,
        timeline: answers.timeline,
      } as any);

      // Try to get lead ID for phone verification step
      try {
        const { data: savedLead } = await supabase
          .from("marketing_leads" as any)
          .select("id")
          .eq("email", contactInfo.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        if (savedLead) setLeadId((savedLead as any).id);
      } catch { /* non-critical */ }

      trackDemoRequest(source);
      // Move to phone verification step instead of finishing
      setStep(QUIZ_STEPS.length + 1);
    } catch (err) {
      console.error("Quiz submission error:", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePhoneVerified = (_phone: string, _result: any) => {
    setPhoneVerified(true);
    setIsSuccess(true);
    onComplete?.();
  };

  const handleSkipPhone = () => {
    setIsSuccess(true);
    onComplete?.();
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-primary" />
        </div>
        <h3 className="text-xl font-semibold mb-2">You're In!</h3>
        <p className="text-muted-foreground">
          Our team will reach out within 24 hours with a personalized demo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Step {step + 1} of {totalSteps}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, backgroundColor: brandConfig?.primaryColor || undefined }}
          />
        </div>
      </div>

      {/* Quiz questions */}
      {!isContactStep && currentQuiz && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{currentQuiz.question}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentQuiz.options.map((option) => (
              <button
                key={option.value}
                onClick={() => selectAnswer(option.value)}
                className={cn(
                  "p-4 rounded-lg border text-left transition-all hover:border-primary hover:bg-primary/5",
                  answers[currentQuiz.id] === option.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-card"
                )}
                style={
                  answers[currentQuiz.id] === option.value && brandConfig?.primaryColor
                    ? { borderColor: brandConfig.primaryColor, color: brandConfig.primaryColor, backgroundColor: `${brandConfig.primaryColor}15` }
                    : undefined
                }
              >
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Contact info step */}
      {isContactStep && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Almost there — tell us about yourself</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quiz-name">Name *</Label>
              <Input
                id="quiz-name"
                placeholder="John Smith"
                value={contactInfo.name}
                onChange={(e) => setContactInfo((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quiz-email">Work Email *</Label>
              <Input
                id="quiz-email"
                type="email"
                placeholder="john@company.com"
                value={contactInfo.email}
                onChange={(e) => setContactInfo((p) => ({ ...p, email: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quiz-company">Company</Label>
            <Input
              id="quiz-company"
              placeholder="Acme Inc."
              value={contactInfo.company}
              onChange={(e) => setContactInfo((p) => ({ ...p, company: e.target.value }))}
            />
          </div>
          <Button
            variant="glow"
            size="lg"
            className="w-full"
            onClick={handleContactSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              "Get My Personalized Demo"
            )}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            By submitting, you agree to our{" "}
            <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
          </p>
        </div>
      )}

      {/* Phone verification step */}
      {isPhoneStep && (
        <PhoneVerificationStep
          leadId={leadId || undefined}
          onVerified={handlePhoneVerified}
          onSkip={handleSkipPhone}
        />
      )}

      {/* Navigation */}
      {step > 0 && !isPhoneStep && (
        <button
          onClick={() => setStep((s) => s - 1)}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
      )}
    </div>
  );
}
