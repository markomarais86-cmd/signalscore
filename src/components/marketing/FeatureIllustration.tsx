import React from "react";
import { cn } from "@/lib/utils";
import { Target, BarChart3, Database, Zap, Users, TrendingUp, CheckCircle } from "lucide-react";

type IllustrationType = "icp-builder" | "tam-generator" | "crm-insights" | "enrichment";

interface FeatureIllustrationProps {
  type: IllustrationType;
  className?: string;
}

// Animated target/bullseye for ICP Builder
function ICPBuilderIllustration() {
  return (
    <div className="relative w-full aspect-video flex items-center justify-center">
      {/* Concentric circles */}
      <div className="absolute w-48 h-48 rounded-full border-2 border-primary/10 animate-pulse" />
      <div className="absolute w-36 h-36 rounded-full border-2 border-primary/20" />
      <div className="absolute w-24 h-24 rounded-full border-2 border-primary/40" />
      <div className="absolute w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
        <Target className="w-6 h-6 text-primary" />
      </div>
      
      {/* Floating data points */}
      <div className="absolute top-4 right-8 px-2 py-1 bg-primary/10 rounded text-xs text-primary animate-float">
        Industry: SaaS
      </div>
      <div className="absolute bottom-8 left-4 px-2 py-1 bg-primary/10 rounded text-xs text-primary animate-float-delayed">
        Size: 50-200
      </div>
      <div className="absolute top-12 left-8 px-2 py-1 bg-primary/10 rounded text-xs text-primary" style={{ animationDelay: "1s" }}>
        Revenue: $5M+
      </div>
    </div>
  );
}

// Chart/graph visualization for TAM Generator
function TAMGeneratorIllustration() {
  const bars = [
    { height: 45, label: "SAM" },
    { height: 70, label: "TAM" },
    { height: 30, label: "SOM" },
  ];

  return (
    <div className="relative w-full aspect-video flex items-end justify-center gap-6 p-6">
      {bars.map((bar, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <div
            className="w-16 rounded-t-lg bg-gradient-to-t from-primary/40 to-primary transition-all duration-500 hover:from-primary/60 hover:to-primary"
            style={{ height: `${bar.height * 2}px` }}
          />
          <span className="text-xs text-muted-foreground">{bar.label}</span>
        </div>
      ))}
      {/* Trend line */}
      <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <TrendingUp className="absolute top-4 right-6 w-5 h-5 text-primary/60" />
    </div>
  );
}

// Data flow diagram for CRM Insights
function CRMInsightsIllustration() {
  return (
    <div className="relative w-full aspect-video flex items-center justify-center p-4">
      {/* Central database */}
      <div className="relative z-10 w-16 h-16 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
        <Database className="w-8 h-8 text-primary" />
      </div>
      
      {/* Connected nodes */}
      <div className="absolute top-4 left-1/4 w-10 h-10 rounded-lg bg-card/80 border border-border/50 flex items-center justify-center">
        <Users className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="absolute top-4 right-1/4 w-10 h-10 rounded-lg bg-card/80 border border-border/50 flex items-center justify-center">
        <BarChart3 className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="absolute bottom-4 left-1/4 w-10 h-10 rounded-lg bg-card/80 border border-border/50 flex items-center justify-center">
        <Target className="w-5 h-5 text-muted-foreground" />
      </div>
      <div className="absolute bottom-4 right-1/4 w-10 h-10 rounded-lg bg-card/80 border border-border/50 flex items-center justify-center">
        <CheckCircle className="w-5 h-5 text-primary" />
      </div>
      
      {/* Connection lines */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <line x1="50%" y1="50%" x2="25%" y2="20%" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="75%" y2="20%" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="25%" y2="80%" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="75%" y2="80%" stroke="hsl(var(--primary) / 0.3)" strokeWidth="1" strokeDasharray="4 4" />
      </svg>
    </div>
  );
}

// Waterfall/verification flow for Enrichment
function EnrichmentIllustration() {
  const steps = [
    { label: "Source 1", status: "verified" },
    { label: "Source 2", status: "verified" },
    { label: "Source 3", status: "verified" },
    { label: "Output", status: "complete" },
  ];

  return (
    <div className="relative w-full aspect-video flex items-center justify-center p-4">
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={cn(
                "w-14 h-14 rounded-lg flex flex-col items-center justify-center text-center",
                step.status === "complete"
                  ? "bg-primary/20 border border-primary/40"
                  : "bg-card/80 border border-border/50"
              )}
            >
              {step.status === "complete" ? (
                <Zap className="w-5 h-5 text-primary" />
              ) : (
                <CheckCircle className="w-4 h-4 text-primary/60" />
              )}
              <span className="text-[8px] text-muted-foreground mt-1">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className="w-4 h-px bg-primary/30" />
            )}
          </div>
        ))}
      </div>
      
      {/* Animated pulse effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-32 h-32 rounded-full border border-primary/10 animate-ping opacity-20" />
      </div>
    </div>
  );
}

export function FeatureIllustration({ type, className }: FeatureIllustrationProps) {
  const illustrations: Record<IllustrationType, () => React.ReactNode> = {
    "icp-builder": ICPBuilderIllustration,
    "tam-generator": TAMGeneratorIllustration,
    "crm-insights": CRMInsightsIllustration,
    "enrichment": EnrichmentIllustration,
  };

  const Illustration = illustrations[type];

  return (
    <div
      className={cn(
        "bg-muted/10 rounded-lg border border-border/30 overflow-hidden",
        className
      )}
    >
      <Illustration />
    </div>
  );
}
