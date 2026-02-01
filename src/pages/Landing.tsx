import { Target, BarChart3, Database, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { GradientBackground } from "@/components/ui/GradientBackground";
import {
  MarketingNav,
  MarketingFooter,
  MarketingHero,
  FeatureCard,
  PainPointCard,
} from "@/components/marketing";

const features = [
  {
    icon: Target,
    title: "AI ICP Builder",
    description:
      "Define and validate your Ideal Customer Profile based on real CRM patterns—not guesswork. Our AI analyzes your closed-won deals to surface the attributes that actually drive revenue.",
  },
  {
    icon: BarChart3,
    title: "TAM Generator",
    description:
      "Build dynamic, segmentable Total Addressable Market lists aligned to your ICP. See exactly how much of your market you're covering and where the biggest whitespace opportunities are.",
  },
  {
    icon: Database,
    title: "CRM Insight Layer",
    description:
      "Surface gaps in your data, personas, segments, and coverage. Understand where pipeline misalignment comes from and get actionable recommendations to fix it.",
  },
  {
    icon: Zap,
    title: "Data Enrichment Engine",
    description:
      "Multi-source data verification waterfall that delivers verified emails, phones, and firmographics at 60-85% less than Apollo, ZoomInfo, or Clay.",
  },
];

const painPoints = [
  "ICP is built on assumptions, not conversion evidence",
  "TAM is static, poorly segmented, and rarely tied to ICP reality",
  "CRM data obscures persona coverage, segment gaps, and lead quality risk",
  "Leadership lacks a clear diagnostic view of what's blocking yield",
];

const stats = [
  { value: "34%", label: "Average TAM coverage increase" },
  { value: "2.3x", label: "Faster ICP validation" },
  { value: "18%", label: "More CRM data accuracy" },
  { value: "$2.4M", label: "Avg. whitespace opportunity found" },
];

export default function Landing() {
  return (
    <GradientBackground variant="hero" showOrbs>
      <main>
        <MarketingNav />

        {/* Hero Section */}
        <MarketingHero
          badge="Where GTM Meets ICP Precision"
          headline={
            <>
              <span className="gradient-text">AI-Driven ICP and TAM</span>
              <br />
              <span className="text-foreground">Intelligence for High-Performance GTM Teams</span>
            </>
          }
          subheadline="LaunchPulse pinpoints your highest-converting customer profile, validates ICP alignment inside your CRM, and exposes where pipeline yield is being constrained by data quality, persona coverage, or segment misfit."
          primaryCta={{ label: "Request Demo", href: "/contact" }}
          secondaryCta={{ label: "Watch Demo" }}
          footnote="No credit card required • Setup in 5 minutes"
        />

        {/* Pain Points Section */}
        <section className="container mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why GTM Teams <span className="gradient-text">Stall</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Most go-to-market teams struggle with these challenges every day
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {painPoints.map((point, index) => (
              <PainPointCard key={index} text={point} delay={0.1 * index} />
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="container mx-auto px-6 py-16">
          <div className="grid md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card
                key={index}
                variant="glass"
                hover="glow"
                className="animate-fade-in"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <CardContent className="pt-6 text-center">
                  <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              What <span className="gradient-text">LaunchPulse</span> Delivers
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Four pillars of GTM intelligence to align your strategy with your best customers
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                delay={0.1 * index}
              />
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-6 py-24">
          <Card variant="gradient" className="overflow-hidden relative">
            {/* Background Glow */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, hsl(161 85% 60% / 0.3), transparent 60%)",
              }}
            />

            <CardContent className="pt-16 pb-16 text-center relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Ready to Transform Your{" "}
                <span className="gradient-text">GTM Strategy</span>?
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Join revenue teams at fast-growing B2B companies who use LaunchPulse
                to align their GTM strategy with their best customers
              </p>
              <a href="/contact">
                <button className="btn-glow inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 text-lg rounded-lg">
                  Request Early Access
                </button>
              </a>
              <p className="text-sm text-muted-foreground mt-6">
                No commitment required • See it in action
              </p>
            </CardContent>
          </Card>
        </section>

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
