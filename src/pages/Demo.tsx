import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";
import { DemoRequestForm } from "@/components/marketing/DemoRequestForm";
import { Sparkles, Users, Zap, BarChart3 } from "lucide-react";

export default function Demo() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingNav />
      
      <main className="pt-24 pb-20">
        <div className="container mx-auto px-6">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm text-primary font-medium">See LaunchPulse in Action</span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold font-heading mb-6 leading-tight">
              Request a Demo
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
              See how LaunchPulse helps GTM teams identify, prioritize, and close high-value accounts faster with AI-powered insights.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start max-w-6xl mx-auto">
            {/* Left Column - Value Props */}
            <div className="space-y-8">
              <h2 className="text-2xl font-semibold">What you'll learn:</h2>
              
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">ICP Scoring & Prioritization</h3>
                    <p className="text-muted-foreground text-sm">
                      How AI automatically scores and ranks your accounts based on your ideal customer profile.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Zap className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Real-Time Signal Detection</h3>
                    <p className="text-muted-foreground text-sm">
                      Capture buying signals the moment they happen—funding rounds, hiring sprees, tech stack changes.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Pipeline Intelligence</h3>
                    <p className="text-muted-foreground text-sm">
                      Get actionable insights into pipeline health, deal velocity, and conversion optimization.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border">
                <p className="text-sm text-muted-foreground">
                  Trusted by revenue teams at fast-growing B2B companies
                </p>
              </div>
            </div>

            {/* Right Column - Form */}
            <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xl">
              <DemoRequestForm source="demo-page" />
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
