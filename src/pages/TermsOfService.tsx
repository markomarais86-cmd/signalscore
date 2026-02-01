import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function TermsOfService() {
  return (
    <GradientBackground forceDark>
      <MarketingNav />
      <main className="min-h-screen">
        <div className="container max-w-4xl mx-auto px-4 py-12">
          <Link to="/landing">
            <Button variant="ghost" className="mb-8 text-white/60 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>

          <h1 className="text-4xl font-bold mb-8 text-white">Terms of Service</h1>
          <p className="text-white/50 mb-8">Last updated: February 1, 2026</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">1. Acceptance of Terms</h2>
              <p className="text-white/70 leading-relaxed">
                By accessing or using LaunchPulse ("the Service"), you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">2. Description of Service</h2>
              <p className="text-white/70 leading-relaxed">
                LaunchPulse is an Ideal Customer Profile (ICP) management and lead scoring platform that helps 
                businesses identify, analyze, and target their best-fit customers. The Service includes data 
                ingestion, ICP creation, account scoring, TAM/SAM/SOM analysis, and campaign building capabilities.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">3. User Accounts</h2>
              <p className="text-white/70 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials and for all 
                activities that occur under your account. You agree to notify us immediately of any unauthorized 
                use of your account.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">4. Data and Privacy</h2>
              <p className="text-white/70 leading-relaxed">
                Your use of the Service is also governed by our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. 
                You retain ownership of all data you upload to the Service. We will not sell your data to third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">5. Acceptable Use</h2>
              <p className="text-white/70 leading-relaxed mb-4">You agree not to:</p>
              <ul className="list-disc list-inside text-white/70 space-y-2">
                <li>Use the Service for any illegal purpose or in violation of any applicable laws</li>
                <li>Upload malicious code or attempt to compromise the security of the Service</li>
                <li>Interfere with or disrupt the Service or servers connected to the Service</li>
                <li>Attempt to gain unauthorized access to any portion of the Service</li>
                <li>Use the Service to send unsolicited communications (spam)</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">6. Intellectual Property</h2>
              <p className="text-white/70 leading-relaxed">
                The Service and its original content, features, and functionality are owned by LaunchPulse and 
                are protected by international copyright, trademark, and other intellectual property laws.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">7. Limitation of Liability</h2>
              <p className="text-white/70 leading-relaxed">
                The Service is provided "as is" without warranties of any kind. We shall not be liable for any 
                indirect, incidental, special, consequential, or punitive damages resulting from your use of 
                the Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">8. Termination</h2>
              <p className="text-white/70 leading-relaxed">
                We may terminate or suspend your account and access to the Service immediately, without prior 
                notice, for conduct that we believe violates these Terms of Service or is harmful to other 
                users of the Service, us, or third parties.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">9. Changes to Terms</h2>
              <p className="text-white/70 leading-relaxed">
                We reserve the right to modify these terms at any time. We will notify users of any material 
                changes by posting the new Terms of Service on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">10. Contact Us</h2>
              <p className="text-white/70 leading-relaxed">
                If you have any questions about these Terms of Service, please contact us at support@launchpulse.io.
              </p>
            </section>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </GradientBackground>
  );
}
