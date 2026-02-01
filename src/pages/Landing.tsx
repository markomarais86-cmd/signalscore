import { Button } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { Link } from "react-router-dom";
import {
  MarketingNav,
  MarketingFooter,
  MarketingHero,
  FeatureCard,
  PainPointCard,
  HeroDashboardMockup,
} from "@/components/marketing";

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

        {/* Pain Points Section - 2 column layout matching original */}
        <section className="container mx-auto px-6 py-24">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            {/* Left side - Text content */}
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-8">
                Why GTM Teams<br />
                <span className="text-white/50">performance stalls even when activity is high:</span>
              </h2>
              <div className="space-y-5">
                {painPoints.map((point, index) => (
                  <PainPointCard key={index} text={point} delay={0.1 * index} />
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
              <img 
                src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695055dccf22527a26df6e62_icp-01.svg"
                alt="ICP Chart"
                className="absolute left-0 top-0 w-[400px]"
                loading="lazy"
                width="400"
              />
              {/* Revenue Stats - bottom right */}
              <img 
                src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/694e6fd27d17f86e6ce24884_total-01.svg"
                alt="Revenue Stats"
                className="absolute right-0 bottom-0 w-[280px]"
                loading="lazy"
                width="280"
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              What LaunchPulse Delivers
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

        {/* CTA Section - Left aligned matching original */}
        <section className="container mx-auto px-6 py-24">
          <div className="max-w-2xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Request Early<br />Access
            </h2>
            <p className="text-lg text-white/60 mb-8">
              Get a fast, explainable view of: who converts, who you should target next, and what's blocking yield today. Request early access to see LaunchPulse mapped against your CRM reality.
            </p>
            <Link to="/contact">
              <Button variant="default" size="xl" className="text-lg gap-2">
                Request Demo
                <DiagonalArrow />
              </Button>
            </Link>
          </div>
        </section>

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
