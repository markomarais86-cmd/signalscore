import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LaunchPulseMark } from "@/components/BrandLogo";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

interface MarketingHeroProps {
  badge?: string;
  headline: ReactNode;
  subheadline: string;
  primaryCta?: {
    label: string;
    href: string;
  };
  secondaryCta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  footnote?: string;
  children?: ReactNode;
}

export function MarketingHero({
  badge,
  headline,
  subheadline,
  primaryCta,
  secondaryCta,
  footnote,
  children,
}: MarketingHeroProps) {
  return (
    <section className="container mx-auto px-6 pt-24 pb-20 text-center relative">
      {badge && (
        <div className="animate-fade-in" style={{ animationDelay: "0.1s" }}>
          <Badge
            className="mb-6 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
            variant="outline"
          >
            <LaunchPulseMark className="w-3 h-3 mr-1" />
            {badge}
          </Badge>
        </div>
      )}

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

      {(primaryCta || secondaryCta) && (
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
          style={{ animationDelay: "0.4s" }}
        >
          {primaryCta && (
            <Link to={primaryCta.href}>
              <Button size="xl" variant="glow" className="text-lg">
                {primaryCta.label}
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          )}
          {secondaryCta && (
            secondaryCta.href ? (
              <Link to={secondaryCta.href}>
                <Button size="xl" variant="glass" className="text-lg">
                  {secondaryCta.label}
                </Button>
              </Link>
            ) : (
              <Button
                size="xl"
                variant="glass"
                className="text-lg"
                onClick={secondaryCta.onClick}
              >
                {secondaryCta.label}
              </Button>
            )
          )}
        </div>
      )}

      {footnote && (
        <p
          className="text-sm text-white/50 mt-6 animate-fade-in"
          style={{ animationDelay: "0.5s" }}
        >
          {footnote}
        </p>
      )}

      {children}
    </section>
  );
}
