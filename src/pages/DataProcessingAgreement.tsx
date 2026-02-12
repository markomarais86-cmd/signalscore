import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function DataProcessingAgreement() {
  return (
    <GradientBackground forceDark>
      <SEOHead
        title="LaunchPulse | Data Processing Agreement"
        description="LaunchPulse Data Processing Agreement (DPA): GDPR-compliant terms governing how we process personal data on your behalf."
        canonicalPath="/dpa"
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

          <h1 className="text-4xl font-bold mb-8 text-white">Data Processing Agreement</h1>
          <p className="text-white/50 mb-8">Last updated: February 1, 2026</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <p className="text-white/70 leading-relaxed">
                This Data Processing Agreement ("DPA") forms part of the{" "}
                <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link> between you 
                ("Controller") and LaunchPulse Ltd ("Processor") and governs the processing of personal data 
                in connection with the LaunchPulse platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">1. Definitions</h2>
              <ul className="list-disc list-inside text-white/70 space-y-2">
                <li><strong className="text-white/90">"Personal Data"</strong> means any information relating to an identified or identifiable natural person.</li>
                <li><strong className="text-white/90">"Data Subject"</strong> means the individual to whom Personal Data relates.</li>
                <li><strong className="text-white/90">"Controller"</strong> means the entity that determines the purposes and means of processing Personal Data (you, the customer).</li>
                <li><strong className="text-white/90">"Processor"</strong> means the entity that processes Personal Data on behalf of the Controller (LaunchPulse).</li>
                <li><strong className="text-white/90">"Sub-processor"</strong> means any third party engaged by the Processor to process Personal Data.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">2. Scope and Purpose of Processing</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                The Processor shall process Personal Data only for the purposes of providing the LaunchPulse 
                Service as described in the Terms of Service. This includes:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-2">
                <li>Storing and organising account and contact data uploaded by the Controller</li>
                <li>Performing ICP scoring, enrichment, and propensity analysis</li>
                <li>Generating AI-powered insights and recommendations</li>
                <li>Facilitating campaign building and data exports</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">3. Processor Obligations</h2>
              <p className="text-white/70 leading-relaxed mb-4">The Processor shall:</p>
              <ul className="list-disc list-inside text-white/70 space-y-2">
                <li>Process Personal Data only on documented instructions from the Controller</li>
                <li>Ensure persons authorised to process Personal Data are bound by confidentiality obligations</li>
                <li>Implement appropriate technical and organisational security measures (see our <Link to="/security" className="text-primary hover:underline">Security page</Link>)</li>
                <li>Assist the Controller in responding to Data Subject rights requests</li>
                <li>Assist the Controller in meeting obligations under Articles 32–36 of the GDPR</li>
                <li>Make available all information necessary to demonstrate compliance and allow for audits</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">4. Sub-processing</h2>
              <p className="text-white/70 leading-relaxed">
                The Controller provides general authorisation for the Processor to engage sub-processors. 
                A current list of sub-processors is maintained at our{" "}
                <Link to="/subprocessors" className="text-primary hover:underline">Subprocessors page</Link>. 
                The Processor shall notify the Controller of any intended changes to sub-processors, giving 
                reasonable opportunity to object. The Processor shall impose equivalent data protection 
                obligations on all sub-processors.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">5. Data Breach Notification</h2>
              <p className="text-white/70 leading-relaxed">
                The Processor shall notify the Controller without undue delay, and in any event within 72 hours, 
                after becoming aware of a Personal Data breach (as defined in GDPR Article 33). The notification 
                shall include the nature of the breach, categories and approximate number of Data Subjects affected, 
                likely consequences, and measures taken or proposed to address the breach.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">6. Data Deletion and Return</h2>
              <p className="text-white/70 leading-relaxed">
                Upon termination of the Service, the Processor shall, at the Controller's choice, delete or 
                return all Personal Data and delete existing copies within 30 days, unless retention is required 
                by applicable law. The Controller may export their data at any time during the subscription period.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">7. Audit Rights</h2>
              <p className="text-white/70 leading-relaxed">
                The Controller may audit the Processor's compliance with this DPA up to once per year, with 
                30 days' written notice. Audits shall be conducted during normal business hours and shall not 
                unreasonably interfere with the Processor's operations. The Processor may satisfy audit requests 
                by providing relevant certifications, audit reports (e.g., SOC 2), or other documentation.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">8. Liability</h2>
              <p className="text-white/70 leading-relaxed">
                Each party's liability under this DPA is subject to the limitations set forth in the Terms of 
                Service. Nothing in this DPA limits either party's liability for breaches of data protection 
                law to the extent such limitation is not permitted by applicable law.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">9. Contact</h2>
              <p className="text-white/70 leading-relaxed">
                For questions about this DPA or to exercise your rights, contact our Data Protection Officer 
                at dpo@launchpulse.io.
              </p>
            </section>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </GradientBackground>
  );
}
