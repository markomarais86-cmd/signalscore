import { Link } from "react-router-dom";
import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
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
          <BrandLogo variant="dark" collapsed={false} />
          <div className="flex items-center gap-4">
            <a href="https://www.facebook.com/launch.pulse/" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors">
              <Facebook className="h-5 w-5" />
            </a>
            <a href="https://www.instagram.com/launch.pulse/" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors">
              <Instagram className="h-5 w-5" />
            </a>
            <a href="https://www.linkedin.com/company/launchpulse/" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors">
              <Linkedin className="h-5 w-5" />
            </a>
            <a href="https://x.com/launchpulse_io" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors">
              <Twitter className="h-5 w-5" />
            </a>
          </div>
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
