import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Target, TrendingUp, Database, Zap, Users, Shield, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";
import { GradientBackground } from "@/components/ui/GradientBackground";

export default function Landing() {
  const pricingPlans = [
    {
      name: "Starter",
      price: "$499",
      period: "/month",
      description: "Perfect for small teams getting started with ICP intelligence",
      features: [
        "1 ICP Profile",
        "Up to 1,000 accounts",
        "Basic TAM analysis",
        "CSV data import",
        "Email support",
        "Monthly reports"
      ],
      cta: "Start Free Trial",
      popular: false
    },
    {
      name: "Professional",
      price: "$1,499",
      period: "/month",
      description: "For growing teams serious about TAM optimization",
      features: [
        "5 ICP Profiles",
        "Up to 10,000 accounts",
        "Advanced TAM intelligence",
        "CRM integrations (Salesforce, HubSpot)",
        "Priority support",
        "Weekly reports",
        "Team collaboration (5 seats)",
        "Custom scoring models"
      ],
      cta: "Start Free Trial",
      popular: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For organizations requiring advanced features and scale",
      features: [
        "Unlimited ICP Profiles",
        "Unlimited accounts",
        "Enterprise TAM intelligence",
        "All integrations + API access",
        "Dedicated success manager",
        "Real-time sync",
        "Unlimited team members",
        "Custom AI agents",
        "SLA guarantees",
        "White-label options"
      ],
      cta: "Contact Sales",
      popular: false
    }
  ];

  const features = [
    {
      icon: Target,
      title: "TAM Coverage Analysis",
      description: "See exactly how much of your addressable market you're actually covering"
    },
    {
      icon: TrendingUp,
      title: "ICP Match Quality",
      description: "Measure how well your accounts align with your ideal customer profile"
    },
    {
      icon: Database,
      title: "Whitespace Mapping",
      description: "Identify high-fit accounts you're missing in your pipeline"
    },
    {
      icon: Zap,
      title: "Automated Scoring",
      description: "AI-powered account scoring based on fit, intent, and reachability"
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Share insights and reports across your revenue operations team"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Bank-level encryption and compliance with SOC 2, GDPR"
    }
  ];

  const stats = [
    { value: "34%", label: "Average TAM coverage increase" },
    { value: "2.3x", label: "Faster pipeline growth" },
    { value: "18%", label: "Improvement in close rates" },
    { value: "$2.4M", label: "Avg. whitespace opportunity found" }
  ];

  return (
    <GradientBackground variant="hero" showOrbs>
      {/* Header */}
      <header className="border-b border-border/50 bg-background/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo variant="light" />
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost" className="text-muted-foreground hover:text-foreground">
                Sign In
              </Button>
            </Link>
            <Link to="/auth">
              <Button variant="glow">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-24 pb-20 text-center relative">
        <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <Badge className="mb-6 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20" variant="outline">
            <Sparkles className="w-3 h-3 mr-1" />
            Where GTM Meets ICP Precision
          </Badge>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold font-heading mb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <span className="gradient-text">Know Your Market</span>
          <br />
          <span className="text-foreground">Coverage</span>
        </h1>
        
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.3s' }}>
          LaunchPulse shows B2B revenue teams exactly how much of their addressable market they're covering—and where the biggest whitespace opportunities are.
        </p>
        
        <div className="flex items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <Link to="/auth">
            <Button size="xl" variant="glow" className="text-lg">
              Start 14-Day Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Button size="xl" variant="glass" className="text-lg">
            Watch Demo
          </Button>
        </div>
        
        <p className="text-sm text-muted-foreground mt-6 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          No credit card required • Setup in 5 minutes
        </p>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-6 py-16">
        <div className="grid md:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card 
              key={index} 
              variant="glass" 
              hover="glow"
              className="animate-fade-in"
              style={{ animationDelay: `${0.1 * index}s` }}
            >
              <CardContent className="pt-6 text-center">
                <div className="text-4xl md:text-5xl font-bold gradient-text mb-2">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Everything You Need for{" "}
            <span className="gradient-text">TAM Intelligence</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From ICP definition to whitespace identification
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              variant="glass" 
              hover="lift"
              className="animate-fade-in"
              style={{ animationDelay: `${0.1 * index}s` }}
            >
              <CardHeader>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-primary/10 border border-primary/20">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, <span className="gradient-text">Transparent</span> Pricing
          </h2>
          <p className="text-xl text-muted-foreground">
            Choose the plan that fits your team size and needs
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6 max-w-7xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <Card 
              key={index} 
              variant={plan.popular ? "gradient" : "glass"}
              hover="lift"
              className={`relative ${plan.popular ? 'md:scale-105 shadow-glow' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground shadow-glow-sm">
                  Most Popular
                </Badge>
              )}
              <CardHeader className="pt-8">
                <CardTitle className="text-2xl">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-5xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth" className="block">
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "glow" : "outline"}
                    size="lg"
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-24">
        <Card variant="gradient" className="overflow-hidden relative">
          {/* Background Glow */}
          <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none"
            style={{ background: 'radial-gradient(circle, hsl(161 85% 60% / 0.3), transparent 60%)' }}
          />
          
          <CardContent className="pt-16 pb-16 text-center relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Ready to <span className="gradient-text">Unlock Your TAM</span>?
            </h2>
            <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
              Join revenue teams at fast-growing B2B companies who use LaunchPulse to optimize their market coverage
            </p>
            <Link to="/auth">
              <Button size="xl" variant="glow" className="text-lg">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-6">
              14-day free trial • No credit card required
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-background/30 backdrop-blur-xl">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <BrandLogo variant="light" showTagline />
            <div className="text-sm text-muted-foreground">
              © 2025 LaunchPulse. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </GradientBackground>
  );
}
