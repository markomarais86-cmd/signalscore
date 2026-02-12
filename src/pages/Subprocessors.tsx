import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

const subprocessors = [
  { name: "Supabase", purpose: "Database, authentication, storage, and edge functions", location: "United States" },
  { name: "OpenAI", purpose: "AI-powered scoring, enrichment, and insight generation", location: "United States" },
  { name: "Resend", purpose: "Transactional and notification email delivery", location: "United States" },
  { name: "Sentry", purpose: "Application error monitoring and performance tracking", location: "United States" },
  { name: "Google Analytics", purpose: "Website analytics and usage measurement", location: "United States" },
];

export default function Subprocessors() {
  return (
    <GradientBackground forceDark>
      <SEOHead
        title="LaunchPulse | Subprocessors"
        description="LaunchPulse Subprocessors: A transparent list of third-party services we use to operate our platform."
        canonicalPath="/subprocessors"
        ogImage="/og/og-default.png"
      />
      <MarketingNav />
      <main className="min-h-screen">
        <div className="container max-w-4xl mx-auto px-4 py-12">
          <Link to="/">
            <Button variant="ghost" className="mb-8 text-white/60 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>

          <h1 className="text-4xl font-bold mb-8 text-white">Subprocessors</h1>
          <p className="text-white/50 mb-8">Last updated: February 1, 2026</p>

          <p className="text-white/70 leading-relaxed mb-8">
            LaunchPulse uses the following third-party service providers (subprocessors) to operate the platform. 
            Each subprocessor is bound by data processing agreements that impose equivalent data protection 
            obligations. We will update this page when subprocessors are added or changed, and notify customers 
            as described in our <Link to="/dpa" className="text-primary hover:underline">Data Processing Agreement</Link>.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="text-left py-4 px-4 text-white font-semibold">Subprocessor</th>
                  <th className="text-left py-4 px-4 text-white font-semibold">Purpose</th>
                  <th className="text-left py-4 px-4 text-white font-semibold">Location</th>
                </tr>
              </thead>
              <tbody>
                {subprocessors.map((sp) => (
                  <tr key={sp.name} className="border-b border-white/10 hover:bg-white/5 transition-colors">
                    <td className="py-4 px-4 text-white font-medium">{sp.name}</td>
                    <td className="py-4 px-4 text-white/70">{sp.purpose}</td>
                    <td className="py-4 px-4 text-white/70">{sp.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-12 space-y-6">
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">Changes to Subprocessors</h2>
              <p className="text-white/70 leading-relaxed">
                We provide customers with prior notice of any changes to our subprocessor list. If you have 
                concerns about a new subprocessor, you may object within 30 days of notification as described 
                in the DPA.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">Questions</h2>
              <p className="text-white/70 leading-relaxed">
                For questions about our subprocessors or data processing practices, contact us at{" "}
                <a href="mailto:privacy@launchpulse.io" className="text-primary hover:underline">privacy@launchpulse.io</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </GradientBackground>
  );
}
