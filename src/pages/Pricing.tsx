import { useState, useEffect } from "react";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SEOHead } from "@/components/SEOHead";
import { DiagonalArrow } from "@/components/ui/DiagonalArrow";
import { MarketingNav, MarketingFooter, MarketingHero, DemoRequestForm } from "@/components/marketing";
import { SEO_EXPERIMENTS } from "@/lib/seo-variants";
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

  // Inject FAQ structured data for rich snippets
  useEffect(() => {
    const faqSchema = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = 'faq-schema';
    script.textContent = JSON.stringify(faqSchema);
    
    // Remove existing if any
    const existing = document.getElementById('faq-schema');
    if (existing) existing.remove();
    
    document.head.appendChild(script);

    return () => {
      const el = document.getElementById('faq-schema');
      if (el) el.remove();
    };
  }, []);

  const handlePricingRequest = (planName: string) => {
    setSelectedPlan(planName);
    setPricingDialogOpen(true);
  };

  return (
    <GradientBackground variant="hero" showOrbs forceDark>
      <SEOHead
        title="LaunchPulse | Pricing"
        description={SEO_EXPERIMENTS.pricing.variants.control}
        descriptionVariants={SEO_EXPERIMENTS.pricing}
        canonicalPath="/pricing"
        ogImage="/og/og-pricing.png"
      />
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

        {/* Trust Indicators */}
        <section className="container mx-auto px-6 py-8">
          <ScrollReveal animation="fade-up">
            <div className="flex flex-wrap justify-center items-center gap-6 text-white/50 text-sm">
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                No long-term contracts required
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                Cancel anytime
              </span>
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                14-day money-back guarantee
              </span>
            </div>
          </ScrollReveal>
        </section>

        {/* Platform Plans */}
        <section className="container mx-auto px-6 py-12">
          <ScrollReveal animation="fade-up">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                Platform Plans
              </h2>
              <p className="text-xl text-white/80 max-w-2xl mx-auto">
                SignalScore is priced based on data volume, intelligence depth, and business impact
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {platformPlans.map((plan, index) => (
              <ScrollReveal key={index} animation="fade-up" delay={0.1 * index}>
                <div
                  className={`group relative rounded-xl border border-white/10 bg-[#1F2227] transition-all duration-300 hover:-translate-y-2 hover:shadow-lg hover:shadow-primary/10 h-full ${plan.popular ? "border-primary/30 shadow-md shadow-primary/5" : "hover:border-white/20"}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  )}
                  <CardHeader className="pt-8 pb-4">
                    <CardTitle className="text-xl !text-white">{plan.name}</CardTitle>
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
                      className="w-full text-white group-hover:scale-[1.02] transition-transform"
                      variant={plan.popular ? "glow" : "outline"}
                      size="sm"
                      onClick={() => handlePricingRequest(plan.name)}
                    >
                      {plan.cta}
                    </Button>
                  </CardContent>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Enrichment Credits */}
        <section className="container mx-auto px-6 py-24">
          <ScrollReveal animation="fade-up">
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
          </ScrollReveal>

          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {creditPacks.map((pack, index) => (
              <ScrollReveal key={index} animation="fade-up" delay={0.1 * index}>
                <div
                  className={`relative rounded-xl border border-white/10 bg-[#1F2227] transition-all duration-300 hover:-translate-y-1 h-full ${pack.popular ? "border-primary/50" : ""}`}
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
                      className="w-full text-white"
                      onClick={() => handlePricingRequest(`${pack.name} Credit Pack`)}
                    >
                      Get Pricing
                    </Button>
                  </CardContent>
                </div>
              </ScrollReveal>
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
          <ScrollReveal animation="fade-up">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                Platform Capabilities
              </h2>
            </div>
          </ScrollReveal>

          <ScrollReveal animation="fade-up" delay={0.2}>
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
          </ScrollReveal>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-6 py-24">
          <ScrollReveal animation="fade-up">
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
                  <ScrollReveal key={idx} animation="fade-up" delay={0.1 * idx}>
                    <div className="flex items-center gap-3 p-4 rounded-lg bg-[#1F2227] border border-white/10">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-white">{item}</span>
                    </div>
                  </ScrollReveal>
                ))}
              </div>
              <p className="mt-8 text-white/60">
                Plans scale as your GTM complexity grows.
              </p>
            </div>
          </ScrollReveal>
        </section>

        {/* FAQ */}
        <section className="container mx-auto px-6 py-24">
          <ScrollReveal animation="fade-up">
            <div className="text-center mb-12">
              <HelpCircle className="h-10 w-10 text-primary mx-auto mb-4" />
              <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                Frequently Asked Questions
              </h2>
            </div>
          </ScrollReveal>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <ScrollReveal key={index} animation="fade-up" delay={0.1 * index}>
                  <AccordionItem
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
                </ScrollReveal>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <ScrollReveal animation="fade-up">
          <section className="relative w-full overflow-hidden">
            <img 
              src="/images/Business_Man.webp"
              alt="Business professional reviewing GTM analytics dashboard"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent" />
            <div className="relative container mx-auto px-6 py-32">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span className="text-sm text-primary font-medium">Early Adopter Pricing Available</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                  Ready to Get<br />Started?
                </h2>
                <p className="text-lg text-white/80 mb-8">
                  Schedule a demo and see how SignalScore can transform your GTM strategy.
                </p>
                <Button 
                  size="xl" 
                  variant="glow" 
                  className="text-lg gap-2"
                  onClick={() => handlePricingRequest("Demo Request")}
                >
                  Request Demo
                  <DiagonalArrow />
                </Button>
              </div>
            </div>
          </section>
        </ScrollReveal>

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
