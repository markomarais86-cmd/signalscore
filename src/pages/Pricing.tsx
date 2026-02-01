import { useState } from "react";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingNav, MarketingFooter, MarketingHero, DemoRequestForm } from "@/components/marketing";
import {
  Check,
  Zap,
  HelpCircle,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function DiagonalArrow({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="18" 
      height="18" 
      viewBox="0 0 18 18" 
      fill="none"
      className={className}
    >
      <path 
        d="M4.38237 12.4016L10.5268 6.25717L5.7538 6.25717L5.7538 4.7574L13.0872 4.7574L13.0872 12.0908L11.5874 12.0908V7.31783L5.44303 13.4622L4.38237 12.4016Z" 
        fill="currentColor"
      />
    </svg>
  );
}

const platformPlans = [
  {
    name: "Pilot",
    price: "90-Day",
    period: "Validation",
    bestFor: "Validation & ROI proof",
    features: [
      "Up to 3,000 accounts",
      "1 ICP Model",
      "Country segmentation",
      "3 months history",
      "Basic AI Agents",
      "1 integration (manual)",
      "500 credits (total)",
    ],
    cta: "Start Pilot",
    popular: false,
  },
  {
    name: "Professional",
    price: "Monthly",
    period: "Subscription",
    bestFor: "Core revenue teams",
    features: [
      "Up to 10,000 accounts",
      "Up to 3 ICP Models",
      "Country segmentation",
      "12 months history",
      "Standard AI Agents",
      "Up to 2 integrations",
      "1,000 credits / mo",
    ],
    cta: "Get Pricing",
    popular: true,
  },
  {
    name: "Growth",
    price: "Monthly",
    period: "Subscription",
    bestFor: "Scaling GTM teams",
    features: [
      "Up to 30,000 accounts",
      "Up to 10 ICP Models",
      "Sub-industry + Region",
      "24 months history",
      "Advanced AI Agents",
      "Unlimited integrations",
      "3,000 credits / mo",
    ],
    cta: "Get Pricing",
    popular: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "Annual",
    bestFor: "Enterprise / PE",
    features: [
      "Unlimited accounts",
      "Unlimited ICP Models",
      "Custom segmentation",
      "Full history",
      "Custom AI Agents",
      "Custom integrations",
      "10K+ credits / mo",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const creditPacks = [
  {
    id: "starter",
    name: "Starter",
    credits: 200,
    popular: false,
  },
  {
    id: "growth",
    name: "Growth",
    credits: 1000,
    popular: true,
  },
  {
    id: "scale",
    name: "Scale",
    credits: 5000,
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    credits: 25000,
    popular: false,
  },
];

const featureComparison = [
  { feature: "ICP & TAM Engine", pilot: true, professional: true, growth: true, enterprise: true },
  { feature: "Revenue Signal Index", pilot: true, professional: true, growth: true, enterprise: true },
  { feature: "Board Dashboards", pilot: true, professional: true, growth: true, enterprise: true },
  { feature: "Persona Conversion Analysis", pilot: true, professional: true, growth: true, enterprise: true },
  { feature: "Multi-Region Analytics", pilot: false, professional: true, growth: true, enterprise: true },
  { feature: "Sub-Industry Modeling", pilot: false, professional: false, growth: true, enterprise: true },
  { feature: "Benchmarking Index", pilot: false, professional: false, growth: true, enterprise: true },
  { feature: "Portfolio View", pilot: false, professional: false, growth: false, enterprise: true },
  { feature: "API Access", pilot: false, professional: false, growth: false, enterprise: true },
  { feature: "SSO / SLA", pilot: false, professional: false, growth: false, enterprise: true },
  { feature: "Dedicated Success Manager", pilot: false, professional: false, growth: false, enterprise: true },
];

const faqs = [
  {
    question: "What's included in enrichment credits?",
    answer:
      "Credits are used for enrichment, verification, and AI research. Each credit allows you to enrich or verify one data point across our multi-source waterfall.",
  },
  {
    question: "Do credits roll over?",
    answer:
      "Monthly included credits do not roll over. However, credits purchased through add-on packs never expire and can be used at any time.",
  },
  {
    question: "What's the difference between Pilot and Professional?",
    answer:
      "Pilot is a 90-day validation program designed to prove ROI before committing to a monthly subscription. Professional is our core plan for revenue teams with ongoing needs.",
  },
  {
    question: "Can I upgrade mid-contract?",
    answer:
      "Yes. Upgrades are applied immediately with prorated billing. Plans scale as your GTM complexity grows.",
  },
  {
    question: "Is there annual billing?",
    answer:
      "Yes. Annual contracts receive preferential pricing. Pilot customers who convert within 90 days retain their negotiated pricing for their first annual term.",
  },
];

export default function Pricing() {
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  const handlePricingRequest = (planName: string) => {
    setSelectedPlan(planName);
    setPricingDialogOpen(true);
  };

  return (
    <GradientBackground variant="hero" showOrbs forceDark>
      <main>
        <MarketingNav />

        {/* Hero Section */}
        <MarketingHero
          headline={
            <>
              <span className="text-white">Simple, Transparent</span>
              <br />
              <span className="text-white">Pricing</span>
            </>
          }
          subheadline="Platform subscription + pay-as-you-go enrichment credits. Request pricing tailored to your needs."
        />

        {/* Platform Plans */}
        <section className="container mx-auto px-6 py-12">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Platform Plans
            </h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              SignalScore is priced based on data volume, intelligence depth, and business impact
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {platformPlans.map((plan, index) => (
              <div
                key={index}
                className={`relative rounded-xl border border-white/10 bg-[#1F2227] transition-all duration-300 hover:-translate-y-1 ${plan.popular ? "border-primary/30" : ""}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="pt-8 pb-4">
                  <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                  <p className="text-sm text-primary">{plan.bestFor}</p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-white">{plan.price}</span>
                    <span className="text-sm text-white/50 ml-1">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-2.5 w-2.5 text-primary" />
                        </div>
                        <span className="text-sm text-white/80">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.popular ? "glow" : "outline"}
                    size="sm"
                    onClick={() => handlePricingRequest(plan.name)}
                  >
                    {plan.cta}
                  </Button>
                </CardContent>
              </div>
            ))}
          </div>
        </section>

        {/* Enrichment Credits */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Zap className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Add-On</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Additional Enrichment Capacity
            </h2>
            <p className="text-xl text-white/80 max-w-2xl mx-auto">
              All plans include monthly credits. Extra capacity is available as needed.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {creditPacks.map((pack, index) => (
              <div
                key={index}
                className={`relative rounded-xl border border-white/10 bg-[#1F2227] transition-all duration-300 hover:-translate-y-1 ${pack.popular ? "border-primary/50" : ""}`}
              >
                {pack.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Popular
                  </Badge>
                )}
                <CardContent className="pt-8 text-center">
                  <h3 className="font-semibold text-lg mb-2 text-white">{pack.name}</h3>
                  <div className="text-5xl font-bold text-primary mb-2">
                    {pack.credits.toLocaleString()}
                  </div>
                  <p className="text-base text-white/60 mb-6">credits</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => handlePricingRequest(`${pack.name} Credit Pack`)}
                  >
                    Get Pricing
                  </Button>
                </CardContent>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-base text-white/60">
              Credits are used for enrichment, verification, and AI research.
            </p>
          </div>
        </section>

        {/* Feature Comparison */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Platform Capabilities
            </h2>
          </div>

          <div className="max-w-5xl mx-auto overflow-hidden rounded-xl border border-white/10 bg-[#1F2227]">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-4 text-lg font-semibold text-white">Capability</th>
                    <th className="text-center p-4 text-lg font-semibold text-white">Pilot</th>
                    <th className="text-center p-4 text-lg font-semibold text-primary">Professional</th>
                    <th className="text-center p-4 text-lg font-semibold text-white">Growth</th>
                    <th className="text-center p-4 text-lg font-semibold text-white">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {featureComparison.map((row, index) => (
                    <tr key={index} className="border-b border-white/10 last:border-0">
                      <td className="p-4 text-base text-white">{row.feature}</td>
                      <td className="p-4 text-center">
                        {row.pilot ? (
                          <Check className="h-5 w-5 text-primary mx-auto" />
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center bg-primary/5">
                        {row.professional ? (
                          <Check className="h-5 w-5 text-primary mx-auto" />
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {row.growth ? (
                          <Check className="h-5 w-5 text-primary mx-auto" />
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {row.enterprise ? (
                          <Check className="h-5 w-5 text-primary mx-auto" />
                        ) : (
                          <span className="text-white/30">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-6 py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-8 text-white">
              How SignalScore Pricing Works
            </h2>
            <p className="text-xl text-white/80 mb-10">
              SignalScore is priced based on data volume, intelligence depth, and business impact — not user seats.
            </p>
            <div className="grid md:grid-cols-2 gap-6">
              {[
                "Core analytics",
                "AI insights",
                "Integrated enrichment",
                "Monthly credit allocation",
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-4 rounded-lg bg-[#1F2227] border border-white/10">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary" />
                  </div>
                  <span className="text-white">{item}</span>
                </div>
              ))}
            </div>
            <p className="mt-8 text-white/60">
              Plans scale as your GTM complexity grows.
            </p>
          </div>
        </section>

        {/* Pilot Conversion Guarantee */}
        <section className="container mx-auto px-6 py-16">
          <div className="max-w-3xl mx-auto">
            <div className="p-8 rounded-xl border border-primary/30 bg-primary/5 text-center">
              <h3 className="text-2xl font-bold mb-4 text-white">
                Pilot Conversion Guarantee
              </h3>
              <p className="text-lg text-white/80">
                Pilot customers who convert within 90 days retain their negotiated pricing for their first annual term.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <HelpCircle className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-[#1F2227] border border-white/10 rounded-lg px-6"
                >
                  <AccordionTrigger className="text-left text-lg font-medium text-white hover:no-underline py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-base text-white/80 pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative w-full overflow-hidden">
          <img 
            src="/images/Business_Man.webp"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
          <div className="relative container mx-auto px-6 py-32">
            <div className="max-w-xl">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                Ready to Get<br />Started?
              </h2>
              <p className="text-lg text-white/80 mb-8">
                Schedule a demo and see how SignalScore can transform your GTM strategy.
              </p>
              <Button 
                size="xl" 
                variant="default" 
                className="text-lg gap-2"
                onClick={() => handlePricingRequest("Demo Request")}
              >
                Request Demo
                <DiagonalArrow />
              </Button>
            </div>
          </div>
        </section>

        <MarketingFooter />

        {/* Pricing Request Dialog */}
        <Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
          <DialogContent className="sm:max-w-lg bg-[#1F2227] border-white/10">
            <DialogHeader>
              <DialogTitle className="text-2xl text-white">
                Get {selectedPlan} Pricing
              </DialogTitle>
              <DialogDescription className="text-white/70">
                Fill out the form below and we'll send you detailed pricing information.
              </DialogDescription>
            </DialogHeader>
            <DemoRequestForm 
              source={`pricing-${selectedPlan.toLowerCase().replace(/\s+/g, '-')}`} 
              onSuccess={() => setPricingDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </main>
    </GradientBackground>
  );
}
