import { GradientBackground } from "@/components/ui/GradientBackground";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Button } from "@/components/ui/button";
import { SEOHead } from "@/components/SEOHead";
import { DiagonalArrow } from "@/components/ui/DiagonalArrow";
import { MarketingNav, MarketingFooter, MarketingHero } from "@/components/marketing";
import { Link } from "react-router-dom";
import { Search, BarChart3, ArrowUpCircle, Rocket, type LucideIcon } from "lucide-react";

const differentiators: { icon: LucideIcon; title: string; subtitle: string; description: string }[] = [
  {
    icon: Search,
    title: "Evidence-Based ICP",
    subtitle: "(not opinion-based targeting)",
    description:
      "LaunchPulse derives ICP from actual CRM conversion patterns, highlighting the attributes and personas that consistently produce pipeline yield.",
  },
  {
    icon: BarChart3,
    title: "Explainable Diagnostics",
    subtitle: "(not opaque scoring)",
    description:
      "Every output is traceable—so RevOps and Sales Leadership can understand why accounts rank, where leakage occurs, and what to fix.",
  },
  {
    icon: ArrowUpCircle,
    title: "Stack-Enhancing by Design",
    subtitle: "(not a rip-and-replace platform)",
    description:
      "LaunchPulse plugs into Salesforce/HubSpot and enrichment sources to make the systems you already pay for materially smarter.",
  },
  {
    icon: Rocket,
    title: "Fast Time-to-Value",
    subtitle: "(without heavy implementation)",
    description:
      "Deploy quickly, get clarity fast, and operationalise insights immediately—without months of integration work or reporting rebuilds.",
  },
];

export default function About() {
  return (
    <GradientBackground variant="hero" showOrbs forceDark>
      <SEOHead
        title="About LaunchPulse — Evidence-Based GTM Intelligence"
        description="Built for RevOps and GTM leaders who are tired of targeting based on assumptions. LaunchPulse delivers evidence-based ICP clarity in days, not months."
        canonicalPath="/about"
        ogImage="/og/og-about.png"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "LaunchPulse",
          url: "https://launchpulse.io",
          description: "AI-powered ICP and TAM intelligence for B2B go-to-market teams.",
          contactPoint: { "@type": "ContactPoint", contactType: "sales", email: "sales@launchpulse.com" },
        }}
      />
      <main>
        <MarketingNav />

        {/* Hero Section */}
        <MarketingHero
          headline={
            <>
              <span className="text-white/40">LaunchPulse exists to</span>
              <br />
              <span className="text-white">make GTM targeting measurable, explainable, and operational</span>
            </>
          }
          subheadline="Who to prioritise, why they convert, and where your CRM reality is diverging from your ICP—so execution is anchored to evidence, not assumptions."
        />

        {/* The LaunchPulse Difference */}
        <section className="container mx-auto px-6 py-24">
          <ScrollReveal animation="fade-up">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
                The LaunchPulse Difference
              </h2>
              <p className="text-xl text-white/60 max-w-2xl mx-auto">
                What makes LaunchPulse different in practice
              </p>
            </div>
          </ScrollReveal>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {differentiators.map((item, index) => {
              const Icon = item.icon;
              return (
                <ScrollReveal key={index} animation="fade-up" delay={0.1 * index}>
                  <div className="group relative p-8 rounded-xl border border-white/10 bg-[#1F2227] overflow-hidden h-full transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-lg hover:shadow-primary/5">
                    {/* Decorative gradient line at top */}
                    <div 
                      className="absolute top-0 left-0 right-0 h-[1px] transition-opacity duration-300 group-hover:opacity-100 opacity-50"
                      style={{ 
                        background: 'linear-gradient(90deg, transparent 0%, rgba(60, 241, 174, 0.3) 50%, transparent 100%)' 
                      }}
                    />
                    <div className="relative z-10">
                      <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20 transition-transform duration-300 group-hover:scale-110">
                        <Icon className="h-7 w-7 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold mb-3 text-white">
                        {item.title} <span className="text-white/50 font-normal">{item.subtitle}</span>
                      </h3>
                      <p className="text-white/70 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </section>


        {/* CTA Banner — gradient, no external CDN images */}
        <section className="container mx-auto px-6 py-24">
          <ScrollReveal animation="scale">
            <div 
              className="relative rounded-3xl overflow-hidden py-20 px-8"
              style={{ background: 'linear-gradient(135deg, hsl(161, 85%, 40%) 0%, hsl(180, 60%, 40%) 100%)' }}
            >
              <div className="relative z-10 text-center max-w-2xl mx-auto">
                <h2 className="text-3xl md:text-5xl font-bold mb-4 text-black italic">
                  A precise,<br />explainable GTM<br />intelligence layer
                </h2>
                <p className="text-lg text-black/70 mb-8">
                  If you want targeting clarity, persona coverage visibility, and a practical path to fixing data-driven pipeline leakage, request a demo.
                </p>
                <Link to="/contact">
                  <Button size="xl" className="text-lg gap-2 bg-black text-white hover:bg-black/90">
                    Request Demo
                    <DiagonalArrow />
                  </Button>
                </Link>
              </div>
            </div>
          </ScrollReveal>
        </section>

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
