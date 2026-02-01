import { Button } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
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
      "Define and validate your ICP using real conversion patterns from your CRM—so targeting is based on evidence, not internal opinion.",
  },
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696964446c7c72967b3789de_Tam%20Generator.svg",
    title: "TAM Generator",
    description:
      "Generate a dynamic, segmentable TAM that stays aligned to your ICP and can be operationalised by territory, industry, size band, region, and buyer persona.",
  },
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a48e374f363cbe28776a0_persona.svg",
    title: "CRM Insight Layer",
    description:
      "Diagnose pipeline misalignment by surfacing data quality risk, persona coverage gaps, segment leakage, and where GTM effort is being misallocated.",
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
          <HeroDashboardMockup className="mt-16" />
        </MarketingHero>

        {/* Pain Points Section */}
        <section className="container mx-auto px-6 py-16 relative overflow-hidden">
          {/* Floating decoration SVGs - matching original */}
          <img 
            src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695055dccf22527a26df6e62_icp-01.svg"
            alt=""
            className="absolute left-0 md:left-10 top-1/2 -translate-y-1/2 w-24 md:w-32 opacity-80 hidden lg:block"
          />
          <img 
            src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/694e6fd27d17f86e6ce24884_total-01.svg"
            alt=""
            className="absolute right-0 md:right-10 top-1/2 -translate-y-1/2 w-24 md:w-32 opacity-80 hidden lg:block"
          />
          {/* Gray background shape */}
          <img 
            src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695012c6ca938bbd9d2d6114_bg_Grey.webp"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-20 pointer-events-none"
          />
          
          <div className="text-center mb-12 relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why GTM Teams performance stalls even when activity is high:
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto relative z-10">
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

        {/* CTA Section - Simplified */}
        <section className="container mx-auto px-6 py-24 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Request Early Access
          </h2>
          <p className="text-xl text-white/60 mb-10 max-w-2xl mx-auto">
            Get a fast, explainable view of: who converts, who you should target next, and what's blocking yield today. Request early access to see LaunchPulse mapped against your CRM reality.
          </p>
          <Link to="/contact">
            <Button variant="default" size="xl" className="text-lg">
              Request Demo
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
