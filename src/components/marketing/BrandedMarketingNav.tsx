import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { DiagonalArrow } from "@/components/ui/DiagonalArrow";
import { Menu, X } from "lucide-react";

interface BrandedMarketingNavProps {
  logoUrl?: string | null;
  companyName?: string | null;
  primaryColor?: string | null;
}

export function BrandedMarketingNav({ logoUrl, companyName, primaryColor }: BrandedMarketingNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="border-b border-white/10 bg-black fixed top-0 left-0 right-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName || "Logo"} className="h-8 max-w-[160px] object-contain" />
            ) : (
              <span className="text-lg font-bold text-white">{companyName || "LaunchPulse"}</span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="text-white/60 hover:text-white">
                Sign In
              </Button>
            </Link>
            <Link to="/contact">
              <Button
                variant="default"
                className="gap-2"
                style={primaryColor ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
              >
                Request Demo
                <DiagonalArrow />
              </Button>
            </Link>
          </div>

          <button
            className="md:hidden p-2 text-white/60 hover:text-white"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-black">
            <nav className="container mx-auto px-6 py-4 flex flex-col gap-2">
              <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full justify-start">Sign In</Button>
              </Link>
              <Link to="/contact" onClick={() => setMobileMenuOpen(false)}>
                <Button
                  variant="default"
                  className="w-full gap-2"
                  style={primaryColor ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
                >
                  Request Demo
                  <DiagonalArrow />
                </Button>
              </Link>
            </nav>
          </div>
        )}
      </header>
      <div className="h-16" />
    </>
  );
}
