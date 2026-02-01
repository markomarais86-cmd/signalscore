import { Card, CardContent } from "@/components/ui/card";
import { GradientBackground } from "@/components/ui/GradientBackground";
import {
  MarketingNav,
  MarketingFooter,
  MarketingHero,
  FeatureCard,
  PainPointCard,
  HeroDashboardMockup,
} from "@/components/marketing";

const features = [
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69696639d97eebd4bc9bcd01_build-01.svg",
    title: "AI ICP Builder",
    description:
      "Define and validate your Ideal Customer Profile based on real CRM patterns—not guesswork. Our AI analyzes your closed-won deals to surface the attributes that actually drive revenue.",
  },
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696964446c7c72967b3789de_Tam%20Generator.svg",
    title: "TAM Generator",
    description:
      "Build dynamic, segmentable Total Addressable Market lists aligned to your ICP. See exactly how much of your market you're covering and where the biggest whitespace opportunities are.",
  },
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a48e374f363cbe28776a0_persona.svg",
    title: "CRM Insight Layer",
    description:
      "Surface gaps in your data, personas, segments, and coverage. Understand where pipeline misalignment comes from and get actionable recommendations to fix it.",
  },
];

const painPoints = [
  "ICP is built on assumptions, not conversion evidence",
  "TAM is static, poorly segmented, and rarely tied to ICP reality",
  "CRM data obscures persona coverage, segment gaps, and lead quality risk",
  "Leadership lacks a clear diagnostic view of what's blocking yield",
];

export default function Landing() {
  return (
    <GradientBackground variant="hero" showOrbs forceDark>
      <main>
        <MarketingNav />

        {/* Hero Section */}
        <MarketingHero
          badge="Where GTM Meets ICP Precision"
          headline={
            <>
              <span className="text-white/40">AI-Driven ICP and TAM</span>
              <br />
              <span className="text-white/40">Intelligence for </span>
              <span className="text-white">High-Performance GTM Teams</span>
            </>
          }
          subheadline="LaunchPulse pinpoints your highest-converting customer profile, validates ICP alignment inside your CRM, and exposes where pipeline yield is being constrained by data quality, persona coverage, or segment misfit."
          primaryCta={{ label: "Request Demo", href: "/contact" }}
          secondaryCta={{ label: "Watch Demo" }}
          footnote="No credit card required • Setup in 5 minutes"
        >
          <HeroDashboardMockup className="mt-16" />
        </MarketingHero>

        {/* Pain Points Section */}
        <section className="container mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why GTM Teams <span className="text-primary">Stall</span>
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Most go-to-market teams struggle with these challenges every day
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
            {painPoints.map((point, index) => (
              <PainPointCard key={index} text={point} delay={0.1 * index} />
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              What <span className="text-primary">LaunchPulse</span> Delivers
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Three pillars of GTM intelligence to align your strategy with your best customers
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {features.map((feature, index) => (
              <FeatureCard
                key={index}
                iconUrl={feature.iconUrl}
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
                <span className="text-primary">GTM Strategy</span>?
              </h2>
              <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
                Join revenue teams at fast-growing B2B companies who use LaunchPulse
                to align their GTM strategy with their best customers
              </p>
              <a href="/contact">
                <button className="btn-glow inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-14 px-8 text-lg rounded-lg">
                  Request Early Access
                </button>
              </a>
              <p className="text-sm text-white/50 mt-6">
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
