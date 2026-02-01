import { GradientBackground } from "@/components/ui/GradientBackground";
import { Button } from "@/components/ui/button";
import { MarketingNav, MarketingFooter, MarketingHero } from "@/components/marketing";
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

const differentiators = [
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a554e5c773e8c22e066f0_icp-01.svg",
    title: "Evidence-Based ICP",
    description:
      "Not opinion-based targeting. LaunchPulse defines your ICP using actual conversion patterns from your CRM data, eliminating guesswork.",
  },
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a54af3f87402c43ea5404_insight-01.svg",
    title: "Explainable Diagnostics",
    description:
      "Not opaque scoring. Every insight comes with clear reasoning and recommendations you can act on immediately.",
  },
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a53d52131b4d6c510ffb2_up-01.svg",
    title: "Stack-Enhancing by Design",
    description:
      "Not a rip-and-replace platform. LaunchPulse integrates with your existing CRM and data sources to maximize ROI.",
  },
  {
    iconUrl: "https://cdn.prod.website-files.com/694961d117761a0a17d0744b/696a547a83395e9e16030b72_launch.svg",
    title: "Fast Time-to-Value",
    description:
      "Without heavy implementation. Connect your CRM and start seeing insights within hours, not months.",
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
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              The <span className="text-primary">LaunchPulse</span> Difference
            </h2>
            <p className="text-xl text-white/60 max-w-2xl mx-auto">
              Built for revenue teams who demand precision and transparency
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {differentiators.map((item, index) => (
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
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20 overflow-hidden">
                    <img src={item.iconUrl} alt={item.title} className="w-8 h-8 object-contain" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-white/70 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
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
