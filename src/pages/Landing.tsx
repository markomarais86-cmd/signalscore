import { Button } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { SEOHead } from "@/components/SEOHead";
import { DiagonalArrow } from "@/components/ui/DiagonalArrow";
import { Link } from "react-router-dom";
import { Target, BarChart3, Users, Zap } from "lucide-react";
import { SEO_EXPERIMENTS } from "@/lib/seo-variants";
import {
  MarketingNav,
  MarketingFooter,
  MarketingHero,
  FeatureCard,
  PainPointCard,
  HeroDashboardMockup,
  NewsletterSignup,
  QuizFunnel,
  ICPVisualization,
  TAMIndicator,
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
        title="LaunchPulse — AI-Driven ICP & TAM Intelligence"
        description={SEO_EXPERIMENTS.landing.variants.control}
        descriptionVariants={SEO_EXPERIMENTS.landing}
        canonicalPath="/"
        ogImage="/og/og-landing.png"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "LaunchPulse",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: "AI-powered ICP and TAM intelligence platform for B2B go-to-market teams.",
          url: "https://launchpulse.io",
          offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free tier available" },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.8", ratingCount: "47" },
        }}
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

        {/* Pain Points Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
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
            
            {/* Right side — native CSS visualizations */}
            <div className="relative lg:block space-y-4">
              <ScrollReveal animation="fade-left" delay={0.2}>
                <ICPVisualization className="animate-float-gentle" />
              </ScrollReveal>
              <ScrollReveal animation="fade-up" delay={0.4}>
                <TAMIndicator className="animate-float-gentle-delayed" />
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

        {/* Quiz Funnel Section */}
        <section className="container mx-auto px-6 py-20">
          <ScrollReveal animation="fade-up">
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                  See How LaunchPulse Fits Your Team
                </h2>
                <p className="text-white/60">
                  Answer 5 quick questions and we'll tailor your demo to your exact GTM challenges.
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-8">
                <QuizFunnel source="landing-quiz" />
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* Newsletter Section */}
        <section className="container mx-auto px-6 py-20">
          <ScrollReveal animation="fade-up">
            <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm p-10">
              <NewsletterSignup source="newsletter-landing" />
            </div>
          </ScrollReveal>
        </section>

        {/* CTA Section — gradient banner, no stock photo */}
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
                  <span className="text-sm text-white font-medium">Limited Early Access Spots</span>
                </div>
                <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
                  Request Early Access
                </h2>
                <p className="text-lg text-white/80 mb-8">
                  Get a fast, explainable view of: who converts, who you should target next, and what's blocking yield today.
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
