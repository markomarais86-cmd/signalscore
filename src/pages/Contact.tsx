import { GradientBackground } from "@/components/ui/GradientBackground";
import { ScrollReveal } from "@/components/ui/ScrollReveal";
import { Card } from "@/components/ui/card";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav, MarketingFooter, MarketingHero, DemoRequestForm } from "@/components/marketing";
import { Mail, Clock, Users, Shield } from "lucide-react";

export default function Contact() {
  return (
    <GradientBackground variant="hero" showOrbs forceDark>
      <SEOHead
        title="Contact LaunchPulse - Request a Demo"
        description="Book a personalized LaunchPulse demo in 30 seconds. Our team responds within 24 hours to show you exactly where your pipeline is leaking revenue."
        canonicalPath="/contact"
      />
      <main>
        <MarketingNav />

        {/* Hero Section */}
        <MarketingHero
          headline={
            <>
              <span className="text-white/40">Let's Talk About Your</span>
              <br />
              <span className="text-white">GTM Challenges</span>
            </>
          }
          subheadline="Ready to see how LaunchPulse can transform your go-to-market strategy? Fill out the form below and our team will reach out within 24 hours."
        />

        {/* Trust Bar */}
        <section className="container mx-auto px-6 py-8">
          <ScrollReveal animation="fade-up">
            <div className="flex flex-wrap justify-center items-center gap-8 text-white/40 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Response within 24hrs</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Join 50+ GTM Teams</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>No commitment required</span>
              </div>
            </div>
          </ScrollReveal>
        </section>

        {/* Contact Section */}
        <section className="container mx-auto px-6 py-12">
          <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Left Column - Contact Info */}
            <ScrollReveal animation="fade-right">
              <div>
                <h2 className="text-3xl font-bold mb-6">Contact Us</h2>
                <p className="text-lg text-white/60 mb-8">
                  Whether you're ready for a demo, have questions about our platform,
                  or want to discuss a partnership opportunity, we'd love to hear from you.
                </p>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20">
                      <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Email Us</h3>
                      <a
                        href="mailto:contact@launchpulse.io"
                        className="text-primary hover:underline"
                      >
                        contact@launchpulse.io
                      </a>
                      <p className="text-sm text-white/50 mt-1">
                        We typically respond within 24 hours
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-12 p-6 bg-white/5 rounded-xl border border-white/10">
                  <h3 className="font-semibold mb-3 text-white">What happens next?</h3>
                  <ul className="space-y-3 text-sm text-white/60">
                    {[
                      "We'll review your submission and reach out within 24 hours",
                      "Schedule a 30-minute discovery call to understand your needs",
                      "Get a personalized demo tailored to your GTM challenges",
                    ].map((step, index) => (
                      <ScrollReveal key={index} animation="fade-up" delay={0.1 * index}>
                        <li className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      </ScrollReveal>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollReveal>

            {/* Right Column - Form */}
            <ScrollReveal animation="fade-left" delay={0.2}>
              <Card className="p-8 border border-white/10 bg-white/5 hover:border-white/20 transition-colors">
                <div className="flex items-center gap-2 mb-6">
                  <h3 className="text-xl font-semibold">Request a Demo</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs font-medium">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary"></span>
                    </span>
                    Free
                  </span>
                </div>
                <DemoRequestForm source="contact-page" />
              </Card>
            </ScrollReveal>
          </div>
        </section>

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
