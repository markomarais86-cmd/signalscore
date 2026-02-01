import { GradientBackground } from "@/components/ui/GradientBackground";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingNav, MarketingFooter, MarketingHero } from "@/components/marketing";
import {
  Check,
  X,
  Zap,
  ArrowRight,
  HelpCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const platformPlans = [
  {
    name: "Starter",
    price: "$299",
    period: "/month",
    description: "For teams getting started with ICP intelligence",
    features: [
      "2,500 accounts",
      "5 users",
      "1 CRM integration",
      "AI ICP Builder",
      "Basic TAM Generator",
      "50 enrichment credits/mo",
      "Email support",
    ],
    cta: "Request Demo",
    popular: false,
  },
  {
    name: "Professional",
    price: "$699",
    period: "/month",
    description: "For growing teams serious about GTM optimization",
    features: [
      "10,000 accounts",
      "15 users",
      "Unlimited CRM integrations",
      "Advanced TAM with segmentation",
      "Persona Conversion Insights",
      "AI Agents",
      "250 enrichment credits/mo",
      "Priority support",
    ],
    cta: "Request Demo",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description: "For organizations requiring advanced features and scale",
    features: [
      "Unlimited accounts",
      "Unlimited users",
      "All integrations + API access",
      "SSO/SAML authentication",
      "Custom enrichment volume",
      "Dedicated success manager",
      "SLA guarantees",
      "Custom reporting",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const creditPacks = [
  {
    id: "starter",
    name: "Starter Pack",
    credits: 250,
    price: 49,
    perCredit: 0.2,
    popular: false,
  },
  {
    id: "growth",
    name: "Growth Pack",
    credits: 1000,
    price: 149,
    perCredit: 0.15,
    popular: true,
  },
  {
    id: "scale",
    name: "Scale Pack",
    credits: 5000,
    price: 499,
    perCredit: 0.1,
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise Pack",
    credits: 25000,
    price: 1999,
    perCredit: 0.08,
    popular: false,
  },
];

const featureComparison = [
  { feature: "AI ICP Builder", starter: true, professional: true, enterprise: true },
  { feature: "TAM Generator", starter: "Basic", professional: "Advanced", enterprise: "Advanced" },
  { feature: "CRM Sync", starter: "1", professional: "Unlimited", enterprise: "Unlimited" },
  { feature: "Persona Insights", starter: false, professional: true, enterprise: true },
  { feature: "AI Agents", starter: false, professional: true, enterprise: true },
  { feature: "API Access", starter: false, professional: false, enterprise: true },
  { feature: "SSO/SAML", starter: false, professional: false, enterprise: true },
  { feature: "Credits/mo", starter: "50", professional: "250", enterprise: "Custom" },
  { feature: "Support", starter: "Email", professional: "Priority", enterprise: "Dedicated" },
];

const faqs = [
  {
    question: "What's included in enrichment credits?",
    answer:
      "Each credit allows you to enrich one lead or account with verified data including emails, phone numbers, firmographic details, and more. Our multi-source verification waterfall ensures high accuracy across all data points.",
  },
  {
    question: "Do credits roll over?",
    answer:
      "Monthly included credits do not roll over. However, credits purchased through add-on packs never expire and can be used at any time.",
  },
  {
    question: "Can I buy credits without a platform subscription?",
    answer:
      "Enrichment credits require an active platform subscription. This ensures you have the full LaunchPulse experience to make the most of your enriched data.",
  },
  {
    question: "How does your pricing compare to competitors?",
    answer:
      "LaunchPulse enrichment is 60-85% cheaper than Apollo ($0.50/credit), 90%+ cheaper than ZoomInfo ($1.50-3.00/contact), and 40-70% cheaper than Clay ($0.08-0.84/record).",
  },
  {
    question: "What counts as one credit?",
    answer:
      "One credit = one enrichment attempt. Quick account enrichments typically use 1-2 credits, full lead enrichments 3-5 credits, and deep research with verification 5-10 credits depending on fields requested.",
  },
];

export default function Pricing() {
  return (
    <GradientBackground variant="hero" showOrbs forceDark>
      <main>
        <MarketingNav />

        {/* Hero Section */}
        <MarketingHero
          badge="Pricing"
          headline={
            <>
              <span className="text-foreground">Simple,</span>{" "}
              <span className="gradient-text">Transparent</span>
              <br />
              <span className="text-foreground">Pricing</span>
            </>
          }
          subheadline="Platform subscription + pay-as-you-go enrichment credits. No hidden fees, no long-term contracts."
        />

        {/* Platform Plans */}
        <section className="container mx-auto px-6 py-12">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Platform <span className="gradient-text">Plans</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Choose the plan that fits your team size and needs
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {platformPlans.map((plan, index) => (
              <Card
                key={index}
                variant={plan.popular ? "gradient" : "glass"}
                hover="lift"
                className={`relative ${plan.popular ? "md:scale-105 shadow-glow z-10" : ""}`}
              >
                {plan.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground shadow-glow-sm">
                    Most Popular
                  </Badge>
                )}
                <CardHeader className="pt-8">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/contact" className="block">
                    <Button
                      className="w-full"
                      variant={plan.popular ? "glow" : "outline"}
                      size="lg"
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </CardContent>
              </Card>
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
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Enrichment <span className="gradient-text">Credit Packs</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Need more data? Add credits to any plan. Save 60-85% vs Apollo, ZoomInfo, and Clay.
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {creditPacks.map((pack, index) => (
              <Card
                key={index}
                variant="glass"
                hover="lift"
                className={`relative ${pack.popular ? "border-primary/50" : ""}`}
              >
                {pack.popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary/10 text-primary border border-primary/30">
                    Best Value
                  </Badge>
                )}
                <CardContent className="pt-8 text-center">
                  <h3 className="font-semibold mb-2">{pack.name}</h3>
                  <div className="text-4xl font-bold gradient-text mb-1">
                    {pack.credits.toLocaleString()}
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">credits</p>
                  <div className="text-2xl font-bold mb-1">${pack.price}</div>
                  <p className="text-sm text-muted-foreground mb-6">
                    ${pack.perCredit.toFixed(2)}/credit
                  </p>
                  <Button variant="outline" size="sm" className="w-full">
                    Add to Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-muted-foreground">
              <strong>Usage examples:</strong> Quick account enrich: 1-2 credits • Full lead
              enrichment: 3-5 credits • Deep research with verification: 5-10 credits
            </p>
          </div>
        </section>

        {/* Feature Comparison */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Feature <span className="gradient-text">Comparison</span>
            </h2>
          </div>

          <Card variant="glass" className="max-w-4xl mx-auto overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-4 font-semibold">Feature</th>
                    <th className="text-center p-4 font-semibold">Starter</th>
                    <th className="text-center p-4 font-semibold text-primary">
                      Professional
                    </th>
                    <th className="text-center p-4 font-semibold">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {featureComparison.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="p-4 text-sm">{row.feature}</td>
                      <td className="p-4 text-center">
                        {typeof row.starter === "boolean" ? (
                          row.starter ? (
                            <Check className="h-5 w-5 text-primary mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm">{row.starter}</span>
                        )}
                      </td>
                      <td className="p-4 text-center bg-primary/5">
                        {typeof row.professional === "boolean" ? (
                          row.professional ? (
                            <Check className="h-5 w-5 text-primary mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm font-medium">{row.professional}</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        {typeof row.enterprise === "boolean" ? (
                          row.enterprise ? (
                            <Check className="h-5 w-5 text-primary mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
                          )
                        ) : (
                          <span className="text-sm">{row.enterprise}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>

        {/* FAQ */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-12">
            <HelpCircle className="h-10 w-10 text-primary mx-auto mb-4" />
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Frequently Asked <span className="gradient-text">Questions</span>
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {faqs.map((faq, index) => (
                <AccordionItem
                  key={index}
                  value={`item-${index}`}
                  className="bg-card/40 backdrop-blur-xl border border-border/50 rounded-lg px-6"
                >
                  <AccordionTrigger className="text-left hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-6 py-24">
          <Card variant="gradient" className="overflow-hidden relative">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, hsl(161 85% 60% / 0.3), transparent 60%)",
              }}
            />
            <CardContent className="pt-16 pb-16 text-center relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Ready to Get <span className="gradient-text">Started</span>?
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Schedule a demo and see how LaunchPulse can transform your GTM strategy.
              </p>
              <Link to="/contact">
                <Button size="xl" variant="glow" className="text-lg">
                  Request Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
