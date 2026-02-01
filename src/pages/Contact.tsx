import { GradientBackground } from "@/components/ui/GradientBackground";
import { Card } from "@/components/ui/card";
import { MarketingNav, MarketingFooter, MarketingHero, DemoRequestForm } from "@/components/marketing";
import { Mail } from "lucide-react";

export default function Contact() {
  return (
    <GradientBackground variant="hero" showOrbs forceDark>
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

        {/* Contact Section */}
        <section className="container mx-auto px-6 py-12">
          <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Left Column - Contact Info */}
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
                      href="mailto:hello@launchpulse.io"
                      className="text-primary hover:underline"
                    >
                      hello@launchpulse.io
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
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                      1
                    </span>
                    <span>We'll review your submission and reach out within 24 hours</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                      2
                    </span>
                    <span>Schedule a 30-minute discovery call to understand your needs</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium shrink-0">
                      3
                    </span>
                    <span>Get a personalized demo tailored to your GTM challenges</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Right Column - Form */}
            <Card className="p-8 border border-white/10 bg-white/5">
              <h3 className="text-xl font-semibold mb-6">Request a Demo</h3>
              <DemoRequestForm source="contact-page" />
            </Card>
          </div>
        </section>

        <MarketingFooter />
      </main>
    </GradientBackground>
  );
}
