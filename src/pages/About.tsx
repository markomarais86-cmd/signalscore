import { GradientBackground } from "@/components/ui/GradientBackground";
import { Button } from "@/components/ui/button";
import { MarketingNav, MarketingFooter, MarketingHero } from "@/components/marketing";
import { Link } from "react-router-dom";
import { Search, BarChart3, ArrowUpCircle, Rocket, type LucideIcon } from "lucide-react";

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
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-white">
              The <span className="text-primary">LaunchPulse</span> Difference
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              What makes LaunchPulse different in practice
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {differentiators.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={index}
                  className="relative p-8 rounded-xl border border-white/10 overflow-hidden animate-fade-in"
                  style={{ animationDelay: `${0.1 * index}s` }}
                >
                  <img 
                    src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a4cf6a9a77e800b6242c1_about-card-2.png"
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover opacity-30"
                  />
                  <div className="relative z-10">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20">
                      <Icon className="h-7 w-7 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold mb-1">
                      {item.title} <span className="text-white/50 font-normal">{item.subtitle}</span>
                    </h3>
                    <p className="text-white/70 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Our Story Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              Built by <span className="text-primary">GTM Operators</span>
            </h2>
            <div className="space-y-6 text-lg text-white/70 text-left">
              <p>
                We've spent years watching revenue teams struggle with the same problems:
                ICPs defined by intuition, TAMs that are static spreadsheets, and CRM data
                that hides more than it reveals.
              </p>
              <p>
                LaunchPulse was built to fix this. We combine AI-powered analysis with
                deep GTM expertise to give you the clarity you need to focus on accounts
                that will actually close.
              </p>
              <p>
                Our platform doesn't replace your team's expertise—it amplifies it. By
                surfacing the patterns in your own data, we help you validate hunches,
                discover blind spots, and execute with precision.
              </p>
            </div>
          </div>
        </section>

        {/* Green Gradient CTA Banner */}
        <section className="container mx-auto px-6 py-24">
          <div 
            className="relative rounded-3xl overflow-hidden py-20 px-8"
            style={{ background: 'linear-gradient(135deg, #00C853 0%, #4ECDC4 100%)' }}
          >
            {/* Floating ICP chart - left */}
            <img 
              src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69505f8e81701ec89798c0a8_icp-01.svg"
              alt="ICP Chart"
              className="absolute left-4 bottom-4 w-48 md:w-72 opacity-80"
            />
            
            {/* Floating TAM card - right */}
            <img 
              src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/695060479ce89b8d2ce475be_TAM-01.svg"
              alt="TAM Card"
              className="absolute right-4 top-4 w-48 md:w-80 opacity-80"
            />
            
            {/* Centered content */}
            <div className="relative z-10 text-center max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-black">
                A precise, explainable GTM intelligence layer
              </h2>
              <p className="text-lg text-black/70 mb-8">
                If you want targeting clarity, ICP validation, and GTM diagnostics anchored to evidence—LaunchPulse is built for you.
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

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
