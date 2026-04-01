import { GradientBackground } from "@/components/ui/GradientBackground";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/SEOHead";
import { DiagonalArrow } from "@/components/ui/DiagonalArrow";
import { MarketingNav, MarketingFooter, MarketingHero } from "@/components/marketing";
import { SEO_EXPERIMENTS } from "@/lib/seo-variants";
import {
  Target,
  BarChart3,
  Users,
  ShieldCheck,
  Zap,
  TrendingUp,
  Filter,
  UserCircle,
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
    "60-85% cheaper than traditional providers",
  ],
  comparison: [
    { provider: "Enterprise Providers", price: "$1.50-3.00", savings: "90%+" },
    { provider: "Sales Intelligence", price: "$0.50", savings: "60-85%" },
    { provider: "Workflow Platforms", price: "$0.08-0.84", savings: "40-70%" },
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
    icon: Filter,
    title: "Sales Leadership",
    description:
      "See where your team's effort is misallocated, which segments have thin coverage, and where to focus for maximum impact.",
  },
  {
    icon: UserCircle,
    title: "Executives",
    description:
      "Get a clear diagnostic view of your market opportunity and where GTM execution is leaving revenue on the table.",
  },
];

export default function Product() {
  return (
    <GradientBackground variant="hero" showOrbs forceDark>
      <SEOHead
        title="LaunchPulse | Product"
        description={SEO_EXPERIMENTS.product.variants.control}
        descriptionVariants={SEO_EXPERIMENTS.product}
        canonicalPath="/product"
        ogImage="/og/og-product.png"
      />
      <main>
        <MarketingNav />

        {/* Hero Section */}
        <MarketingHero
          headline={
            <>
              <span className="text-white/40">LaunchPulse connects to your CRM</span>
              <br />
              <span className="text-white">and transforms raw activity and outcome history</span>
            </>
          }
          subheadline="into clear ICP, TAM, persona, and data-quality insights—built to improve pipeline yield and targeting precision."
          primaryCta={{ label: "Request Demo", href: "/contact" }}
        />

        {/* Core Features - Simple Cards */}
        <section className="container mx-auto px-6 py-24">
          <ScrollReveal animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                Core <span className="text-primary">Capabilities</span>
              </h2>
              <p className="text-xl text-white/60 max-w-2xl mx-auto">
                Everything you need to align your GTM strategy with your best customers
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {productFeatures.map((feature, index) => (
              <ScrollReveal key={index} animation="fade-up" delay={0.1 * index}>
                <div className="p-8 rounded-xl border border-white/10 bg-[#1F2227] h-full">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20">
                    <feature.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-2xl font-bold mb-2 text-white">{feature.title}</h3>
                  <p className="text-primary mb-4">{feature.subtitle}</p>
                  <p className="text-white/60 mb-6 leading-relaxed">
                    {feature.description}
                  </p>
                  <ul className="space-y-2">
                    {feature.highlights.map((highlight, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        </div>
                        <span className="text-sm text-white">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </section>

        {/* Enrichment Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="max-w-6xl mx-auto">
            <ScrollReveal animation="fade-up">
              <div className="text-center mb-16">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-primary">NEW</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-4">
                  <span className="text-primary">Data Enrichment Engine</span>
                </h2>
                <p className="text-xl text-white/60 max-w-2xl mx-auto">
                  {enrichmentSection.subtitle}
                </p>
              </div>
            </ScrollReveal>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <ScrollReveal animation="fade-right">
                <div>
                  <p className="text-lg text-white/60 mb-8 leading-relaxed">
                    {enrichmentSection.description}
                  </p>
                  <ul className="space-y-4 mb-8">
                    {enrichmentSection.highlights.map((highlight, idx) => (
                      <li key={idx} className="flex items-center gap-3">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        </div>
                        <span className="text-white">{highlight}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/pricing">
                    <Button variant="default" className="gap-2">
                      See Pricing
                      <DiagonalArrow />
                    </Button>
                  </Link>
                </div>
              </ScrollReveal>

              <ScrollReveal animation="fade-left" delay={0.2}>
                <div className="p-6 rounded-xl border border-white/10 bg-[#1F2227]">
                  <h4 className="font-semibold mb-4 text-white">Cost Comparison Per Lead</h4>
                  <div className="space-y-3">
                    {enrichmentSection.comparison.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          item.provider === "LaunchPulse"
                            ? "bg-primary/10 border border-primary/30"
                            : "bg-white/5"
                        }`}
                      >
                        <span
                          className={
                            item.provider === "LaunchPulse"
                              ? "font-semibold text-primary"
                              : "text-white/50"
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
                </div>
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="container mx-auto px-6 py-24">
          <ScrollReveal animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                Built for <span className="text-primary">GTM Teams</span>
              </h2>
              <p className="text-xl text-white/60 max-w-2xl mx-auto">
                Role-specific insights for every stakeholder
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {useCases.map((useCase, index) => {
              const Icon = useCase.icon;
              return (
                <ScrollReveal key={index} animation="scale" delay={0.1 * index}>
                  <div className="p-8 rounded-xl border border-white/10 bg-[#1F2227] text-center h-full hover:bg-[#262a30] hover:border-white/20 transition-all duration-300">
                    <div className="w-16 h-16 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20 mx-auto">
                      <Icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-white">{useCase.title}</h3>
                    <p className="text-white/60 leading-relaxed">{useCase.description}</p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </section>

        {/* CTA Section — gradient banner */}
        <ScrollReveal animation="fade-up">
          <section className="container mx-auto px-6 py-24">
            <div
              className="relative rounded-3xl overflow-hidden py-20 px-8"
              style={{ background: 'linear-gradient(135deg, hsl(161, 85%, 30%) 0%, hsl(161, 85%, 50%) 50%, hsl(180, 60%, 35%) 100%)' }}
            >
              <div className="relative z-10 text-center max-w-2xl mx-auto">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/20 border border-white/20 mb-6">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                  </span>
                  <span className="text-sm text-white font-medium">Get Started in Under 24 Hours</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                  Ready to See<br />Your Data Differently?
                </h2>
                <p className="text-lg text-white/80 mb-8">
                  Connect your CRM and discover insights you've been missing.
                </p>
                <Link to="/contact">
                  <Button size="xl" className="text-lg gap-2 bg-black text-white hover:bg-black/90">
                    Request Demo
                    <DiagonalArrow />
                  </Button>
                </Link>
              </div>
            </div>
          </section>
        </ScrollReveal>

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
