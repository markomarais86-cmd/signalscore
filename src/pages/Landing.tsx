import { Button } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SEOHead } from "@/components/SEOHead";
import { DiagonalArrow } from "@/components/ui/DiagonalArrow";
import { Link } from "react-router-dom";
import { Target, BarChart3, Users, Zap } from "lucide-react";
import {
  MarketingNav,
  MarketingFooter,
  MarketingHero,
  FeatureCard,
  PainPointCard,
  HeroDashboardMockup,
} from "@/components/marketing";

// Trust stats for social proof
const trustStats = [
  { value: "14,000+", label: "Accounts Scored" },
  { value: "99%", label: "Data Accuracy" },
  { value: "<24hr", label: "Time to Insights" },
];

const features = [
  {
    icon: Target,
    title: "AI ICP Builder",
    description:
      "Define and validate your ICP using real conversion patterns from your CRM—so targeting is based on evidence, not internal opinion.",
  },
  {
    icon: BarChart3,
    title: "TAM Generator",
    description:
      "Generate a dynamic, segmentable TAM that stays aligned to your ICP and can be operationalised by territory, industry, size band, region, and buyer persona.",
  },
  {
    icon: Users,
    title: "CRM Insight Layer",
    description:
      "Diagnose pipeline misalignment by surfacing data quality risk, persona coverage gaps, segment leakage, and where GTM effort is being misallocated.",
  },
  {
    icon: Zap,
    title: "Data Enrichment",
    description:
      "AI-powered enrichment waterfall verifies data across multiple premium sources to deliver highest accuracy at a fraction of competitor costs.",
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
      <SEOHead
        title="LaunchPulse - AI-Driven ICP & TAM Intelligence Platform"
        description="Stop guessing which accounts convert. LaunchPulse uses AI to analyze your CRM data and reveal your true ICP in under 24 hours. Request a free demo."
        canonicalPath="/landing"
        ogImage="/og/og-landing.png"
      />
      <main>
        <MarketingNav />

        {/* Hero Section */}
        <MarketingHero
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
        >
          {/* Trust Stats Bar */}
          <ScrollReveal animation="fade-up" delay={0.1}>
            <div className="flex flex-wrap justify-center gap-8 mt-8 mb-8">
              {trustStats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-primary">{stat.value}</div>
                  <div className="text-sm text-white/50">{stat.label}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
          
          <ScrollReveal animation="scale" delay={0.2}>
            <HeroDashboardMockup className="mt-8" />
          </ScrollReveal>
        </MarketingHero>

        {/* Pain Points Section - 2 column layout matching original */}
        <section className="container mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            {/* Left side - Text content */}
            <div>
              <ScrollReveal animation="fade-up">
                <h2 className="text-3xl md:text-4xl font-bold mb-8 text-white">
                  Why GTM Teams<br />
                  <span className="text-white/50">performance stalls even when activity is high:</span>
                </h2>
              </ScrollReveal>
              <div className="space-y-5">
                {painPoints.map((point, index) => (
                  <ScrollReveal key={index} animation="fade-right" delay={0.1 * index}>
                    <PainPointCard text={point} delay={0} />
                  </ScrollReveal>
                ))}
              </div>
            </div>
            
            {/* Right side - Images */}
            <div className="relative lg:block h-[400px]">
              {/* Background shape */}
              <img 
                src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695012c6ca938bbd9d2d6114_bg_Grey.webp"
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-30"
                loading="lazy"
              />
              {/* ICP Chart - larger, positioned left */}
              <ScrollReveal animation="fade-left" delay={0.2}>
                <img 
                  src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695055dccf22527a26df6e62_icp-01.svg"
                  alt="ICP Chart"
                  className="absolute left-0 top-0 w-[400px] animate-float-gentle"
                  loading="lazy"
                  width="400"
                />
              </ScrollReveal>
              {/* Revenue Stats - bottom right */}
              <ScrollReveal animation="fade-up" delay={0.4}>
                <img 
                  src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/694e6fd27d17f86e6ce24884_total-01.svg"
                  alt="Revenue Stats"
                  className="absolute right-0 bottom-0 w-[280px] animate-float-gentle-delayed"
                  loading="lazy"
                  width="280"
                />
              </ScrollReveal>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-6 py-24">
          <ScrollReveal animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                What LaunchPulse Delivers
              </h2>
            </div>
          </ScrollReveal>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <ScrollReveal key={index} animation="fade-up" delay={0.1 * index}>
                <FeatureCard
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  delay={0}
                />
              </ScrollReveal>
            ))}
          </div>
        </section>


        {/* CTA Section - With Business Man Background */}
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
                  <span className="text-sm text-primary font-medium">Limited Early Access Spots</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                  Request Early<br />Access
                </h2>
                <p className="text-lg text-white/80 mb-8">
                  Get a fast, explainable view of: who converts, who you should target next, and what's blocking yield today. Request early access to see LaunchPulse mapped against your CRM reality.
                </p>
                <Link to="/contact">
                  <Button variant="glow" size="xl" className="text-lg gap-2">
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
