import { GradientBackground } from "@/components/ui/GradientBackground";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MarketingNav, MarketingFooter, MarketingHero } from "@/components/marketing";
import { ArrowRight, Target, Lightbulb, Layers, Zap } from "lucide-react";
import { Link } from "react-router-dom";

const differentiators = [
  {
    icon: Target,
    title: "Evidence-Based ICP",
    description:
      "Not opinion-based targeting. LaunchPulse defines your ICP using actual conversion patterns from your CRM data, eliminating guesswork.",
  },
  {
    icon: Lightbulb,
    title: "Explainable Diagnostics",
    description:
      "Not opaque scoring. Every insight comes with clear reasoning and recommendations you can act on immediately.",
  },
  {
    icon: Layers,
    title: "Stack-Enhancing by Design",
    description:
      "Not a rip-and-replace platform. LaunchPulse integrates with your existing CRM and data sources to maximize ROI.",
  },
  {
    icon: Zap,
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
          badge="Our Mission"
          headline={
            <>
              <span className="text-foreground">LaunchPulse exists to make</span>
              <br />
              <span className="gradient-text">GTM targeting measurable, explainable, and operational</span>
            </>
          }
          subheadline="We believe go-to-market teams deserve tools that show their work. No black boxes. No magic scores. Just clear, actionable intelligence that aligns your strategy with your best customers."
        />

        {/* The LaunchPulse Difference */}
        <section className="container mx-auto px-6 py-24">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              The <span className="gradient-text">LaunchPulse</span> Difference
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Built for revenue teams who demand precision and transparency
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {differentiators.map((item, index) => (
              <Card
                key={index}
                variant="glass"
                hover="lift"
                className="animate-fade-in"
                style={{ animationDelay: `${0.1 * index}s` }}
              >
                <CardContent className="p-8">
                  <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 bg-primary/10 border border-primary/20">
                    <item.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Our Story Section */}
        <section className="container mx-auto px-6 py-24">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-8">
              Built by <span className="gradient-text">GTM Operators</span>
            </h2>
            <div className="space-y-6 text-lg text-muted-foreground text-left">
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

        {/* CTA Section */}
        <section className="container mx-auto px-6 py-24">
          <Card variant="gradient" className="overflow-hidden relative">
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, hsl(161 85% 60% / 0.3), transparent 60%)",
              }}
            />
            <CardContent className="pt-16 pb-16 text-center relative z-10">
              <h2 className="text-4xl md:text-5xl font-bold mb-4">
                Ready to See <span className="gradient-text">LaunchPulse</span> in Action?
              </h2>
              <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
                Schedule a demo and discover how precision GTM intelligence can
                transform your pipeline.
              </p>
              <Link to="/contact">
                <Button size="xl" variant="glow" className="text-lg">
                  Request Demo
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
