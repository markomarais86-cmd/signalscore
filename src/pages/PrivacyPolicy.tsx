import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function PrivacyPolicy() {
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

          <h1 className="text-4xl font-bold mb-8 text-white">Privacy Policy</h1>
          <p className="text-white/50 mb-8">Last updated: December 4, 2024</p>

          <div className="prose prose-invert max-w-none space-y-8">
            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">1. Introduction</h2>
              <p className="text-white/70 leading-relaxed">
                LaunchPulse ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy 
                explains how we collect, use, disclose, and safeguard your information when you use our ICP 
                management and lead scoring platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">2. Information We Collect</h2>
              <h3 className="text-xl font-medium mb-3 text-white/90">Personal Information</h3>
              <p className="text-white/70 leading-relaxed mb-4">
                We collect information you provide directly, including:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-2 mb-4">
                <li>Name and email address when you create an account</li>
                <li>Company name and role information</li>
                <li>Payment information when you subscribe to paid features</li>
              </ul>

              <h3 className="text-xl font-medium mb-3 text-white/90">Business Data</h3>
              <p className="text-white/70 leading-relaxed mb-4">
                When using our Service, you may upload:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-2">
                <li>Account and lead data from your CRM</li>
                <li>Contact information for scoring and analysis</li>
                <li>Firmographic data about target companies</li>
                <li>Campaign and export history</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">3. How We Use Your Information</h2>
              <p className="text-white/70 leading-relaxed mb-4">We use your information to:</p>
              <ul className="list-disc list-inside text-white/70 space-y-2">
                <li>Provide, maintain, and improve our Service</li>
                <li>Process your ICP scoring and analysis requests</li>
                <li>Generate insights and recommendations for your business</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Protect against fraudulent or illegal activity</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">4. Data Sharing and Disclosure</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                We do not sell your personal data or business data to third parties. We may share information:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-2">
                <li>With service providers who assist in operating our Service</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and the safety of users</li>
                <li>With your consent or at your direction</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">5. Data Security</h2>
              <p className="text-white/70 leading-relaxed">
                We implement appropriate technical and organizational security measures to protect your data, 
                including encryption in transit and at rest, secure authentication, and regular security audits. 
                However, no method of transmission over the Internet is 100% secure.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">6. Data Retention</h2>
              <p className="text-white/70 leading-relaxed">
                We retain your data for as long as your account is active or as needed to provide you services. 
                You may request deletion of your data at any time by contacting us. Some data may be retained 
                as required by law or for legitimate business purposes.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">7. Your Rights</h2>
              <p className="text-white/70 leading-relaxed mb-4">
                Depending on your location, you may have the right to:
              </p>
              <ul className="list-disc list-inside text-white/70 space-y-2">
                <li>Access the personal data we hold about you</li>
                <li>Correct inaccurate or incomplete data</li>
                <li>Request deletion of your data</li>
                <li>Object to or restrict processing of your data</li>
                <li>Data portability</li>
                <li>Withdraw consent at any time</li>
              </ul>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">8. Cookies and Tracking</h2>
              <p className="text-white/70 leading-relaxed">
                We use cookies and similar technologies to maintain your session, remember your preferences, 
                and analyze how our Service is used. You can control cookies through your browser settings.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">9. Third-Party Integrations</h2>
              <p className="text-white/70 leading-relaxed">
                Our Service integrates with third-party platforms such as Salesforce and HubSpot. When you 
                connect these integrations, data may be shared according to those platforms' privacy policies. 
                We recommend reviewing their policies before connecting.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">10. Changes to This Policy</h2>
              <p className="text-white/70 leading-relaxed">
                We may update this Privacy Policy from time to time. We will notify you of any changes by 
                posting the new Privacy Policy on this page and updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4 text-white">11. Contact Us</h2>
              <p className="text-white/70 leading-relaxed">
                If you have any questions about this Privacy Policy or our data practices, please contact us 
                at contact@launchpulse.io.
              </p>
            </section>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </GradientBackground>
  );
}
