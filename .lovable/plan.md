

## Overview

Complete overhaul of the Pricing page to implement the new SignalScore pricing structure with GBP currency, 4 plan tiers (Pilot, Professional, Growth, Enterprise), updated feature comparison table, new credit packs, and additional explanatory sections.

---

## Key Changes Summary

| Section | Current State | New State |
|---------|--------------|-----------|
| Currency | USD ($) | GBP (£) |
| Plan Tiers | Starter, Professional, Enterprise | Pilot, Professional, Growth, Enterprise |
| Feature Comparison | 9 rows | 11 capabilities with new structure |
| Credit Packs | 4 packs in USD | 4 packs in USD (updated pricing) |
| New Sections | None | "How It Works" + "Pilot Conversion Guarantee" |
| Title Colors | Mixed grey/green | All white (matching About page) |

---

## Visual/Brand Fixes

The following title color corrections will be applied to match the rest of the marketing site:

1. **Section Titles**: All section headings will be pure `text-white` (no green spans), matching the About page pattern
2. **Subheadlines**: Use `text-white/60` or `text-white/70` for secondary text
3. **Card Backgrounds**: Keep existing `bg-[#1F2227]` (already correct)

---

## Technical Details

### File: `src/pages/Pricing.tsx`

### 1. Update Platform Plans Data (lines 38-92)

Replace the current `platformPlans` array with the new 4-tier structure:

```tsx
const platformPlans = [
  {
    name: "Pilot",
    price: "£6,000",
    period: "/ 90 days",
    bestFor: "Validation & ROI proof",
    features: [
      "Up to 3,000 accounts",
      "1 ICP Model",
      "Country segmentation",
      "3 months history",
      "Basic AI Agents",
      "1 integration (manual)",
      "500 credits (total)",
    ],
    cta: "Start Pilot",
    popular: false,
  },
  {
    name: "Professional",
    price: "From £999",
    period: "–£1,299 / mo",
    bestFor: "Core revenue teams",
    features: [
      "Up to 10,000 accounts",
      "Up to 3 ICP Models",
      "Country segmentation",
      "12 months history",
      "Standard AI Agents",
      "Up to 2 integrations",
      "1,000 credits / mo",
    ],
    cta: "Request Demo",
    popular: true,
  },
  {
    name: "Growth",
    price: "From £1,799",
    period: "–£2,499 / mo",
    bestFor: "Scaling GTM teams",
    features: [
      "Up to 30,000 accounts",
      "Up to 10 ICP Models",
      "Sub-industry + Region",
      "24 months history",
      "Advanced AI Agents",
      "Unlimited integrations",
      "3,000 credits / mo",
    ],
    cta: "Get Pricing",
    popular: false,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "(£40K+ / yr)",
    bestFor: "Enterprise / PE",
    features: [
      "Unlimited accounts",
      "Unlimited ICP Models",
      "Custom segmentation",
      "Full history",
      "Custom AI Agents",
      "Custom integrations",
      "10K+ credits / mo",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];
```

### 2. Update Credit Packs Data (lines 94-127)

Update with new pricing structure:

```tsx
const creditPacks = [
  {
    id: "starter",
    name: "Starter",
    credits: 200,
    price: 79,
    popular: false,
  },
  {
    id: "growth",
    name: "Growth",
    credits: 1000,
    price: 299,
    popular: true,
  },
  {
    id: "scale",
    name: "Scale",
    credits: 5000,
    price: 1099,
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    credits: 25000,
    price: null, // Custom
    popular: false,
  },
];
```

### 3. Update Feature Comparison Data (lines 129-139)

Replace with new Platform Capabilities structure:

```tsx
const featureComparison = [
  { feature: "ICP & TAM Engine", pilot: true, professional: true, growth: true, enterprise: true },
  { feature: "Revenue Signal Index", pilot: true, professional: true, growth: true, enterprise: true },
  { feature: "Board Dashboards", pilot: true, professional: true, growth: true, enterprise: true },
  { feature: "Persona Conversion Analysis", pilot: true, professional: true, growth: true, enterprise: true },
  { feature: "Multi-Region Analytics", pilot: false, professional: true, growth: true, enterprise: true },
  { feature: "Sub-Industry Modeling", pilot: false, professional: false, growth: true, enterprise: true },
  { feature: "Benchmarking Index", pilot: false, professional: false, growth: true, enterprise: true },
  { feature: "Portfolio View", pilot: false, professional: false, growth: false, enterprise: true },
  { feature: "API Access", pilot: false, professional: false, growth: false, enterprise: true },
  { feature: "SSO / SLA", pilot: false, professional: false, growth: false, enterprise: true },
  { feature: "Dedicated Success Manager", pilot: false, professional: false, growth: false, enterprise: true },
];
```

### 4. Update Hero Section (lines 176-186)

Fix headline styling (all white, no green spans):

```tsx
<MarketingHero
  headline={
    <>
      <span className="text-white">Simple, Transparent</span>
      <br />
      <span className="text-white">Pricing</span>
    </>
  }
  subheadline="Platform subscription + pay-as-you-go enrichment credits. No hidden fees, no long-term contracts."
/>
```

### 5. Update Platform Plans Section Title (lines 190-197)

```tsx
<div className="text-center mb-12">
  <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
    Platform Plans
  </h2>
  <p className="text-lg text-white/70">
    SignalScore is priced based on data volume, intelligence depth, and business impact
  </p>
</div>
```

### 6. Update Plan Cards Grid (lines 199-241)

Change from 3-column to 4-column grid and update card layout to show "Best For" field:

```tsx
<div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
  {platformPlans.map((plan, index) => (
    <div
      key={index}
      className={`relative rounded-xl border border-white/10 bg-[#1F2227] transition-all duration-300 hover:-translate-y-1 ${plan.popular ? "border-primary/30" : ""}`}
    >
      {plan.popular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
          Most Popular
        </Badge>
      )}
      <CardHeader className="pt-8 pb-4">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <p className="text-sm text-primary">{plan.bestFor}</p>
        <div className="mt-4">
          <span className="text-3xl font-bold text-white">{plan.price}</span>
          <span className="text-sm text-white/50">{plan.period}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {plan.features.map((feature, idx) => (
            <li key={idx} className="flex items-start gap-2">
              <div className="w-4 h-4 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="h-2.5 w-2.5 text-primary" />
              </div>
              <span className="text-sm text-white/80">{feature}</span>
            </li>
          ))}
        </ul>
        <Link to="/contact" className="block">
          <Button
            className="w-full"
            variant={plan.popular ? "glow" : "outline"}
            size="sm"
          >
            {plan.cta}
          </Button>
        </Link>
      </CardContent>
    </div>
  ))}
</div>
```

### 7. Update Feature Comparison Section (lines 296-363)

Update table to 4-column layout with new headers:

```tsx
<section className="container mx-auto px-6 py-24">
  <div className="text-center mb-12">
    <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
      Platform Capabilities
    </h2>
  </div>

  <div className="max-w-5xl mx-auto overflow-hidden rounded-xl border border-white/10 bg-[#1F2227]">
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/10">
            <th className="text-left p-4 font-semibold text-white">Capability</th>
            <th className="text-center p-4 font-semibold text-white">Pilot</th>
            <th className="text-center p-4 font-semibold text-primary">Professional</th>
            <th className="text-center p-4 font-semibold text-white">Growth</th>
            <th className="text-center p-4 font-semibold text-white">Enterprise</th>
          </tr>
        </thead>
        <tbody>
          {featureComparison.map((row, index) => (
            <tr key={index} className="border-b border-white/10 last:border-0">
              <td className="p-4 text-sm text-white">{row.feature}</td>
              <td className="p-4 text-center">
                {row.pilot ? (
                  <Check className="h-5 w-5 text-primary mx-auto" />
                ) : (
                  <span className="text-white/30">—</span>
                )}
              </td>
              <td className="p-4 text-center bg-primary/5">
                {row.professional ? (
                  <Check className="h-5 w-5 text-primary mx-auto" />
                ) : (
                  <span className="text-white/30">—</span>
                )}
              </td>
              <td className="p-4 text-center">
                {row.growth ? (
                  <Check className="h-5 w-5 text-primary mx-auto" />
                ) : (
                  <span className="text-white/30">—</span>
                )}
              </td>
              <td className="p-4 text-center">
                {row.enterprise ? (
                  <Check className="h-5 w-5 text-primary mx-auto" />
                ) : (
                  <span className="text-white/30">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
</section>
```

### 8. Update Credit Packs Section (lines 244-294)

Update title and card content:

```tsx
<section className="container mx-auto px-6 py-24">
  <div className="text-center mb-12">
    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
      <Zap className="h-4 w-4 text-primary" />
      <span className="text-sm font-medium text-primary">Add-On</span>
    </div>
    <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">
      Additional Enrichment Capacity
    </h2>
    <p className="text-lg text-white/70 max-w-2xl mx-auto">
      All plans include monthly credits. Extra capacity is available as needed.
    </p>
  </div>

  <div className="grid md:grid-cols-4 gap-6 max-w-5xl mx-auto">
    {creditPacks.map((pack, index) => (
      <div
        key={index}
        className={`relative rounded-xl border border-white/10 bg-[#1F2227] transition-all duration-300 hover:-translate-y-1 ${pack.popular ? "border-primary/50" : ""}`}
      >
        {pack.popular && (
          <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
            Popular
          </Badge>
        )}
        <CardContent className="pt-8 text-center">
          <h3 className="font-semibold mb-2 text-white">{pack.name}</h3>
          <div className="text-4xl font-bold text-primary mb-1">
            {pack.credits.toLocaleString()}
          </div>
          <p className="text-sm text-white/50 mb-4">credits</p>
          <div className="text-2xl font-bold mb-4 text-white">
            {pack.price ? `$${pack.price}` : "Custom"}
          </div>
          <Button variant="outline" size="sm" className="w-full">
            {pack.price ? "Add to Plan" : "Contact Sales"}
          </Button>
        </CardContent>
      </div>
    ))}
  </div>

  <div className="mt-12 text-center">
    <p className="text-sm text-white/50">
      Credits are used for enrichment, verification, and AI research.
    </p>
  </div>
</section>
```

### 9. Add New "How It Works" Section (after Feature Comparison)

```tsx
<section className="container mx-auto px-6 py-24">
  <div className="max-w-3xl mx-auto text-center">
    <h2 className="text-3xl md:text-4xl font-bold mb-6 text-white">
      How SignalScore Pricing Works
    </h2>
    <p className="text-lg text-white/70 mb-8">
      SignalScore is priced based on data volume, intelligence depth, and business impact — not user seats.
    </p>
    <div className="grid md:grid-cols-2 gap-6">
      {[
        "Core analytics",
        "AI insights",
        "Integrated enrichment",
        "Monthly credit allocation",
      ].map((item, idx) => (
        <div key={idx} className="flex items-center gap-3 p-4 rounded-lg bg-[#1F2227] border border-white/10">
          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
            <Check className="h-3 w-3 text-primary" />
          </div>
          <span className="text-white">{item}</span>
        </div>
      ))}
    </div>
    <p className="mt-8 text-white/50">
      Plans scale as your GTM complexity grows.
    </p>
  </div>
</section>
```

### 10. Add "Pilot Conversion Guarantee" Section (after How It Works)

```tsx
<section className="container mx-auto px-6 py-16">
  <div className="max-w-3xl mx-auto">
    <div className="p-8 rounded-xl border border-primary/30 bg-primary/5 text-center">
      <h3 className="text-2xl font-bold mb-4 text-white">
        Pilot Conversion Guarantee
      </h3>
      <p className="text-lg text-white/70">
        Pilot customers who convert within 90 days retain their negotiated pricing for their first annual term.
      </p>
    </div>
  </div>
</section>
```

### 11. Update FAQs Data (lines 141-167)

Update with pricing-relevant questions:

```tsx
const faqs = [
  {
    question: "What's included in enrichment credits?",
    answer:
      "Credits are used for enrichment, verification, and AI research. Each credit allows you to enrich or verify one data point across our multi-source waterfall.",
  },
  {
    question: "Do credits roll over?",
    answer:
      "Monthly included credits do not roll over. However, credits purchased through add-on packs never expire and can be used at any time.",
  },
  {
    question: "What's the difference between Pilot and Professional?",
    answer:
      "Pilot is a 90-day validation program designed to prove ROI before committing to a monthly subscription. Professional is our core plan for revenue teams with ongoing needs.",
  },
  {
    question: "Can I upgrade mid-contract?",
    answer:
      "Yes. Upgrades are applied immediately with prorated billing. Plans scale as your GTM complexity grows.",
  },
  {
    question: "Is there annual billing?",
    answer:
      "Yes. Annual contracts receive preferential pricing. Pilot customers who convert within 90 days retain their negotiated pricing for their first annual term.",
  },
];
```

---

## Visual Result

After implementation:
- 4 plan tiers (Pilot, Professional, Growth, Enterprise) with GBP pricing
- All section titles in pure white (matching About page)
- 4-column feature comparison with 11 capabilities
- Updated credit packs with new pricing
- New "How It Works" and "Pilot Conversion Guarantee" sections
- Consistent card styling with `bg-[#1F2227]`

