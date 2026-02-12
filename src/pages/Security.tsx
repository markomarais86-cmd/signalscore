import { ArrowLeft, Shield, Lock, Server, Eye, AlertTriangle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { SEOHead } from "@/components/SEOHead";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

export default function Security() {
  return (
    <GradientBackground forceDark>
      <SEOHead
        title="LaunchPulse | Security"
        description="LaunchPulse Security Overview: How we protect your data with encryption, access controls, and compliance measures."
        canonicalPath="/security"
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

          <div className="flex items-center gap-3 mb-8">
            <Shield className="h-10 w-10 text-primary" />
            <h1 className="text-4xl font-bold text-white">Security Overview</h1>
          </div>
          <p className="text-white/50 mb-8">Last updated: February 1, 2026</p>

          <p className="text-white/70 leading-relaxed text-lg mb-12">
            At LaunchPulse, the security of your data is foundational to everything we build. This page 
            describes the technical and organisational measures we employ to protect your information.
          </p>

          <div className="space-y-10">
            <section className="border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Server className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold text-white">Infrastructure</h2>
              </div>
              <ul className="text-white/70 space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span>Hosted on <strong className="text-white/90">Supabase</strong> (AWS infrastructure) with data centres in the United States</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span><strong className="text-white/90">Encryption at rest</strong> using AES-256 for all stored data</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span><strong className="text-white/90">Encryption in transit</strong> using TLS 1.2+ for all network communications</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span>Automated backups with Point-in-Time Recovery (PITR) support</span>
                </li>
              </ul>
            </section>

            <section className="border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold text-white">Authentication &amp; Access Controls</h2>
              </div>
              <ul className="text-white/70 space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span><strong className="text-white/90">Row Level Security (RLS)</strong> enforced on every database table, ensuring strict org-level data isolation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span><strong className="text-white/90">Multi-tenant architecture</strong> with org_id scoping — no organisation can access another's data</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span><strong className="text-white/90">Multi-Factor Authentication (MFA)</strong> via TOTP for enhanced account security</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span>Role-based access control with admin, member, and viewer permission levels</span>
                </li>
              </ul>
            </section>

            <section className="border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold text-white">Data Isolation</h2>
              </div>
              <p className="text-white/70 leading-relaxed">
                LaunchPulse operates a multi-tenant architecture where every row of data is scoped to a specific 
                organisation via <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm">org_id</code>. 
                Database-level Row Level Security policies enforce this isolation, meaning queries can never 
                return data belonging to another organisation — even in the event of an application-level bug.
              </p>
            </section>

            <section className="border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold text-white">Incident Response</h2>
              </div>
              <p className="text-white/70 leading-relaxed mb-4">
                In the event of a security incident, our response process includes:
              </p>
              <ul className="text-white/70 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold shrink-0">1.</span>
                  <span><strong className="text-white/90">Detection and containment</strong> — Automated monitoring and alerting via Sentry and infrastructure logs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold shrink-0">2.</span>
                  <span><strong className="text-white/90">Assessment</strong> — Determine scope, severity, and affected parties</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold shrink-0">3.</span>
                  <span><strong className="text-white/90">Notification</strong> — Affected customers notified within 72 hours per GDPR requirements</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-semibold shrink-0">4.</span>
                  <span><strong className="text-white/90">Remediation</strong> — Root cause analysis and preventive measures implemented</span>
                </li>
              </ul>
            </section>

            <section className="border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold text-white">Compliance</h2>
              </div>
              <ul className="text-white/70 space-y-3">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span>Supabase infrastructure is <strong className="text-white/90">SOC 2 Type II</strong> certified</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span>GDPR-compliant data processing with a published <Link to="/dpa" className="text-primary hover:underline">Data Processing Agreement</Link></span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400 mt-0.5 shrink-0" />
                  <span>International transfers protected by Standard Contractual Clauses (SCCs)</span>
                </li>
              </ul>
            </section>

            <section className="border border-white/10 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Lock className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-semibold text-white">Responsible Disclosure</h2>
              </div>
              <p className="text-white/70 leading-relaxed">
                If you discover a security vulnerability, please report it responsibly to{" "}
                <a href="mailto:security@launchpulse.io" className="text-primary hover:underline">security@launchpulse.io</a>. 
                We ask that you give us reasonable time to address the issue before disclosing it publicly. 
                We do not pursue legal action against researchers who follow responsible disclosure practices.
              </p>
            </section>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </GradientBackground>
  );
}
