import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Target, TrendingUp, Database, Zap, Users, Shield } from "lucide-react";
import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/BrandLogo";

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <BrandLogo variant="light" />
          <div className="flex items-center gap-4">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24 text-center">
        <Badge className="mb-6" variant="secondary">
          Where GTM Meets ICP Precision
        </Badge>
        <h1 className="text-6xl font-bold font-heading mb-6 bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-transparent">
          Know Your Market Coverage
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
          LaunchPulse shows B2B revenue teams exactly how much of their addressable market they're covering—and where the biggest whitespace opportunities are.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/auth">
            <Button size="lg" className="text-lg px-8">
              Start 14-Day Free Trial
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Button size="lg" variant="outline" className="text-lg px-8">
            Watch Demo
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-4">
          No credit card required • Setup in 5 minutes
        </p>
      </section>

      {/* Stats Section */}
      <section className="container mx-auto px-6 py-12">
        <div className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-4xl font-bold text-primary mb-2">34%</div>
              <div className="text-sm text-muted-foreground">Average TAM coverage increase</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-4xl font-bold text-primary mb-2">2.3x</div>
              <div className="text-sm text-muted-foreground">Faster pipeline growth</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-4xl font-bold text-primary mb-2">18%</div>
              <div className="text-sm text-muted-foreground">Improvement in close rates</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <div className="text-4xl font-bold text-primary mb-2">$2.4M</div>
              <div className="text-sm text-muted-foreground">Avg. whitespace opportunity found</div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Everything You Need for TAM Intelligence</h2>
          <p className="text-xl text-muted-foreground">
            From ICP definition to whitespace identification
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-6 py-24 bg-muted/30 rounded-3xl">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Simple, Transparent Pricing</h2>
          <p className="text-xl text-muted-foreground">
            Choose the plan that fits your team size and needs
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <Card 
              key={index} 
              className={`relative ${plan.popular ? 'border-primary border-2 shadow-xl scale-105' : ''}`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Most Popular
                </Badge>
              )}
              <CardHeader>
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
                      <Check className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/auth" className="block">
                  <Button 
                    className="w-full" 
                    variant={plan.popular ? "default" : "outline"}
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
      <section className="container mx-auto px-6 py-24 text-center">
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-secondary/5">
          <CardContent className="pt-12 pb-12">
            <h2 className="text-4xl font-bold mb-4">Ready to Unlock Your TAM?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join revenue teams at fast-growing B2B companies who use SignalScore to optimize their market coverage
            </p>
            <Link to="/auth">
              <Button size="lg" className="text-lg px-8">
                Start Your Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <p className="text-sm text-muted-foreground mt-4">
              14-day free trial • No credit card required
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <BrandLogo variant="light" showTagline />
            <div className="text-sm text-muted-foreground">
              © 2025 LaunchPulse. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
