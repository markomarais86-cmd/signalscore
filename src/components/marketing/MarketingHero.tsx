import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface MarketingHeroProps {
  headline: ReactNode;
  subheadline: string;
  primaryCta?: {
    label: string;
    href: string;
  };
  children?: ReactNode;
}

export function MarketingHero({
  headline,
  subheadline,
  primaryCta,
  children,
}: MarketingHeroProps) {
  return (
    <section className="container mx-auto px-6 pt-24 pb-20 text-center relative">
      <h1
        className="text-4xl sm:text-5xl md:text-7xl font-bold font-heading mb-6 animate-fade-in"
        style={{ animationDelay: "0.2s" }}
      >
        {headline}
      </h1>

      <p
        className="text-lg md:text-xl text-white/60 max-w-3xl mx-auto mb-10 animate-fade-in"
        style={{ animationDelay: "0.3s" }}
      >
        {subheadline}
      </p>

      {primaryCta && (
        <div
          className="flex items-center justify-center animate-fade-in"
          style={{ animationDelay: "0.4s" }}
        >
          <Link to={primaryCta.href}>
            <Button size="xl" variant="default" className="text-lg">
              {primaryCta.label}
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      )}

      {children}
    </section>
  );
}
