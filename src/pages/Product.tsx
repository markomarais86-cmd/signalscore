import { GradientBackground } from "@/components/ui/GradientBackground";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketingNav, MarketingFooter, MarketingHero } from "@/components/marketing";
import {
  ArrowRight,
  Target,
  BarChart3,
  Users,
  ShieldCheck,
  Zap,
  DollarSign,
  TrendingUp,
  Briefcase,
} from "lucide-react";
import { Link } from "react-router-dom";

const productFeatures = [
  {
    icon: Target,
    title: "ICP Builder",
    subtitle: "Identify what 'good' looks like in your CRM",
    description:
      "Our AI analyzes your closed-won deals to surface the firmographic, technographic, and behavioral attributes that actually predict success. Stop guessing—start knowing.",
    highlights: [
      "Pattern recognition across 50+ attributes",
      "Conversion-weighted scoring",
      "Segment-specific ICP profiles",
      "Continuous refinement as you close deals",
    ],
  },
  {
    icon: BarChart3,
    title: "TAM Generator",
    subtitle: "Dynamic TAM mapped directly to your ICP",
    description:
      "Generate segmentable Total Addressable Market lists that are aligned to your validated ICP. See exactly where your whitespace is and how much of your market you're actually covering.",
    highlights: [
      "ICP-aligned account scoring",
      "Segment and territory mapping",
      "Whitespace identification",
      "Coverage gap analysis",
    ],
  },
  {
    icon: Users,
    title: "Persona Conversion Insights",
    subtitle: "Quantify which personas convert",
    description:
      "Understand which buyer personas are associated with wins vs. losses. Optimize your outreach, content, and sequences based on actual conversion data.",
    highlights: [
      "Persona-level win rate analysis",
      "Title and seniority patterns",
      "Multi-threading insights",
      "Champion identification",
    ],
  },
  {
    icon: ShieldCheck,
    title: "CRM Data Quality Analysis",
    subtitle: "Diagnose data quality risks",
    description:
      "Surface gaps in your CRM data that are hiding persona coverage issues, segment misalignment, and lead quality risks. Get actionable recommendations to fix them.",
    highlights: [
      "Data completeness scoring",
      "Field-level quality metrics",
      "Enrichment recommendations",
      "Duplicate detection",
    ],
  },
];

const enrichmentSection = {
  icon: Zap,
  title: "Data Enrichment Engine",
  subtitle: "Multi-source verification at unbeatable prices",
  description:
    "Our AI-powered enrichment waterfall verifies data across multiple premium sources to deliver the highest accuracy at a fraction of competitor costs.",
  highlights: [
    "Multi-source verification waterfall",
    "Real-time web scraping & validation",
    "Verified emails, phones, and firmographics",
    "60-85% cheaper than Apollo, ZoomInfo, Clay",
  ],
  comparison: [
    { provider: "ZoomInfo", price: "$1.50-3.00", savings: "90%+" },
    { provider: "Apollo", price: "$0.50", savings: "60-85%" },
    { provider: "Clay", price: "$0.08-0.84", savings: "40-70%" },
    { provider: "LaunchPulse", price: "$0.08-0.20", savings: "—" },
  ],
};

const useCases = [
  {
    icon: TrendingUp,
    title: "RevOps",
    description:
      "Validate ICP/TAM assumptions, identify leakage points in your funnel, and build data-backed business cases for leadership.",
  },
  {
    icon: Briefcase,
    title: "Sales Leadership",
    description:
      "See where your team's effort is misallocated, which segments have thin coverage, and where to focus for maximum impact.",
  },
  {
    icon: DollarSign,
    title: "Executives",
    description:
      "Get a clear diagnostic view of your market opportunity and where GTM execution is leaving revenue on the table.",
  },
];

export default function Product() {
  return (
    <GradientBackground variant="hero" showOrbs forceDark>
      <main>
        <MarketingNav />

        {/* Hero Section */}
        <MarketingHero
          badge="Product Overview"
          headline={
            <>
              <span className="text-foreground">Transform Raw CRM Data into</span>
              <br />
              <span className="gradient-text">Precision GTM Intelligence</span>
            </>
          }
          subheadline="LaunchPulse connects to your CRM and transforms raw activity and outcome history into a precise, continuously refined map of who to target, why they convert, and where your pipeline is leaking."
          primaryCta={{ label: "Request Demo", href: "/contact" }}
          secondaryCta={{ label: "View Pricing", href: "/pricing" }}
        />

        {/* Core Features - Clean Card Grid */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Core <span className="gradient-text">Capabilities</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to align your GTM strategy with your best customers
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {productFeatures.map((feature, index) => (
              <Card
                key={index}
                variant="glass"
                hover="lift"
                className="animate-fade-in"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <CardContent className="p-8">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2">{feature.title}</h3>
                  <p className="text-primary mb-4">{feature.subtitle}</p>
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  <ul className="space-y-2">
                    {feature.highlights.map((highlight, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                        <span className="text-sm">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Enrichment Section - NEW */}
        <section className="container mx-auto px-6 py-24 bg-muted/5">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                <Zap className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium text-primary">NEW</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="gradient-text">Data Enrichment Engine</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                {enrichmentSection.subtitle}
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
                  {enrichmentSection.description}
                </p>
                <ul className="space-y-4 mb-8">
                  {enrichmentSection.highlights.map((highlight, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      </div>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/pricing">
                  <Button variant="glow">
                    See Pricing
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <Card variant="glass" className="p-6">
                <h4 className="font-semibold mb-4">Cost Comparison Per Lead</h4>
                <div className="space-y-3">
                  {enrichmentSection.comparison.map((item, idx) => (
                    <div
                      key={idx}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        item.provider === "LaunchPulse"
                          ? "bg-primary/10 border border-primary/30"
                          : "bg-muted/10"
                      }`}
                    >
                      <span
                        className={
                          item.provider === "LaunchPulse"
                            ? "font-semibold text-primary"
                            : "text-muted-foreground"
                        }
                      >
                        {item.provider}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="font-mono">{item.price}</span>
                        {item.savings !== "—" && (
                          <span className="text-sm text-primary">
                            Save {item.savings}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Built for <span className="gradient-text">GTM Teams</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Role-specific insights for every stakeholder
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {useCases.map((useCase, index) => (
              <Card
                key={index}
                variant="glass"
                hover="lift"
                className="animate-fade-in"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <CardContent className="p-8 text-center">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20 mx-auto">
                    <useCase.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{useCase.title}</h3>
                  <p className="text-muted-foreground">{useCase.description}</p>
                </CardContent>
              </Card>
            ))}
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
                Ready to See <span className="gradient-text">Your Data</span> Differently?
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Connect your CRM and discover insights you've been missing.
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
