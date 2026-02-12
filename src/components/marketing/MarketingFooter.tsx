import { Link } from "react-router-dom";
import { NewsletterSignup } from "./NewsletterSignup";

export function MarketingFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/10 py-8">
      <div className="container mx-auto px-6 space-y-6">
        <div className="max-w-xs">
          <NewsletterSignup source="newsletter-footer" compact />
        </div>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <img 
          src="https://cdn.prod.website-files.com/694961d117761a0a17d0744b/69497386bcff6817bd62fe29_light-01.svg" 
          alt="LaunchPulse" 
          className="h-6"
          width="136"
          height="24"
          loading="lazy"
        />
        <div className="flex items-center gap-6 flex-wrap">
          <Link to="/privacy" className="text-sm text-white/50 hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link to="/terms" className="text-sm text-white/50 hover:text-white transition-colors">
            Terms of Service
          </Link>
          <Link to="/dpa" className="text-sm text-white/50 hover:text-white transition-colors">
            DPA
          </Link>
          <Link to="/security" className="text-sm text-white/50 hover:text-white transition-colors">
            Security
          </Link>
          <Link to="/subprocessors" className="text-sm text-white/50 hover:text-white transition-colors">
            Subprocessors
          </Link>
        </div>
        <p className="text-sm text-white/50">
          © {currentYear} LaunchPulse. All rights reserved.
        </p>
        </div>
      </div>
    </footer>
  );
}
