import { GradientBackground } from "@/components/ui/GradientBackground";
import { Button } from "@/components/ui/button";
import { MarketingNav, MarketingFooter, MarketingHero } from "@/components/marketing";
import {
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

// Diagonal arrow SVG matching original launchpulse.org
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
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a568544cb17760d8d12f2_graph.svg",
    title: "RevOps",
    description:
      "Validate ICP/TAM assumptions, identify leakage points in your funnel, and build data-backed business cases for leadership.",
  },
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a568bd4d6d4b54f1e4315_pipeline.svg",
    title: "Sales Leadership",
    description:
      "See where your team's effort is misallocated, which segments have thin coverage, and where to focus for maximum impact.",
  },
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a5691bdbe3c4be51e5766_executives.svg",
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
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              Core <span className="text-primary">Capabilities</span>
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Everything you need to align your GTM strategy with your best customers
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {productFeatures.map((feature, index) => (
              <div
                key={index}
                className="p-8 rounded-xl border border-white/10 bg-white/5 animate-fade-in"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
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
            ))}
          </div>
        </section>

        {/* Enrichment Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="max-w-6xl mx-auto">
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

            <div className="grid lg:grid-cols-2 gap-12 items-center">
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

              <div className="p-6 rounded-xl border border-white/10 bg-white/5">
                <h4 className="font-semibold mb-4">Cost Comparison Per Lead</h4>
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
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Built for <span className="text-primary">GTM Teams</span>
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Role-specific insights for every stakeholder
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {useCases.map((useCase, index) => (
              <div
                key={index}
                className="p-8 rounded-xl border border-white/10 bg-white/5 text-center animate-fade-in"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20 mx-auto overflow-hidden">
                  <img src={useCase.iconUrl} alt={useCase.title} className="w-8 h-8 object-contain" />
                </div>
                <h3 className="text-xl font-semibold mb-3">{useCase.title}</h3>
                <p className="text-white/60">{useCase.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section - With Business Man Background */}
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
                Ready to See<br />Your Data Differently?
              </h2>
              <p className="text-lg text-white/80 mb-8">
                Connect your CRM and discover insights you've been missing.
              </p>
              <Link to="/contact">
                <Button size="xl" variant="default" className="text-lg gap-2">
                  Request Demo
                  <DiagonalArrow />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
