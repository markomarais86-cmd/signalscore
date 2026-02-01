

## Overview

Complete redesign of the Pricing page to:
1. **Hide specific prices** - Replace exact pricing with "Get Pricing" messaging
2. **Add lead capture** - All CTA buttons open a pricing request dialog instead of linking to contact
3. **Fix readability** - Larger, brighter headings and FAQ text
4. **Change currency display** - Remove all £ symbols since prices won't be shown

---

## Key Changes Summary

| Issue | Current State | New State |
|-------|--------------|-----------|
| Prices shown | £6,000, £999, etc. | "Get Pricing", "Contact Us" |
| CTAs | Link to /contact | Open pricing request dialog |
| Headings | `text-white` (but small) | `text-white` larger sizes |
| FAQ text | `text-white/60` (too dark) | `text-white/80` (brighter) |
| Accordion questions | No explicit color | `text-white text-lg` |

---

## Technical Details

### File: `src/pages/Pricing.tsx`

### 1. Add Dialog Import and State (top of file)

Add imports for Dialog components and useState:

```tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DemoRequestForm } from "@/components/marketing";
```

### 2. Add State for Dialog (inside component)

```tsx
export default function Pricing() {
  const [pricingDialogOpen, setPricingDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  
  const handlePricingRequest = (planName: string) => {
    setSelectedPlan(planName);
    setPricingDialogOpen(true);
  };
```

### 3. Update Platform Plans Data - Remove Prices

Replace pricing with value-focused messaging:

```tsx
const platformPlans = [
  {
    name: "Pilot",
    price: "90-Day",
    period: "Validation",
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
    price: "Monthly",
    period: "Subscription",
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
    cta: "Get Pricing",
    popular: true,
  },
  {
    name: "Growth",
    price: "Monthly",
    period: "Subscription",
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
    period: "Annual",
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

### 4. Update Credit Packs - Remove Dollar Prices

```tsx
const creditPacks = [
  {
    id: "starter",
    name: "Starter",
    credits: 200,
    popular: false,
  },
  {
    id: "growth",
    name: "Growth",
    credits: 1000,
    popular: true,
  },
  {
    id: "scale",
    name: "Scale",
    credits: 5000,
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    credits: 25000,
    popular: false,
  },
];
```

### 5. Update Hero Headline - Larger Size

Change subheadline to be more visible:

```tsx
<MarketingHero
  headline={
    <>
      <span className="text-white">Simple, Transparent</span>
      <br />
      <span className="text-white">Pricing</span>
    </>
  }
  subheadline="Platform subscription + pay-as-you-go enrichment credits. Request pricing tailored to your needs."
/>
```

### 6. Update Section Headings - Larger & Brighter

Platform Plans section:

```tsx
<div className="text-center mb-12">
  <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
    Platform Plans
  </h2>
  <p className="text-xl text-white/80 max-w-2xl mx-auto">
    SignalScore is priced based on data volume, intelligence depth, and business impact
  </p>
</div>
```

Additional Enrichment Capacity section:

```tsx
<h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
  Additional Enrichment Capacity
</h2>
<p className="text-xl text-white/80 max-w-2xl mx-auto">
  All plans include monthly credits. Extra capacity is available as needed.
</p>
```

Platform Capabilities section:

```tsx
<h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
  Platform Capabilities
</h2>
```

How It Works section:

```tsx
<h2 className="text-4xl md:text-5xl font-bold mb-8 text-white">
  How SignalScore Pricing Works
</h2>
<p className="text-xl text-white/80 mb-10">
  ...
</p>
```

FAQ section:

```tsx
<h2 className="text-4xl md:text-5xl font-bold mb-6 text-white">
  Frequently Asked Questions
</h2>
```

### 7. Update Plan Card Buttons - Open Dialog

Replace Link with onClick handler:

```tsx
<Button
  className="w-full"
  variant={plan.popular ? "glow" : "outline"}
  size="sm"
  onClick={() => handlePricingRequest(plan.name)}
>
  {plan.cta}
</Button>
```

### 8. Update Credit Pack Cards - Remove Price Display

```tsx
<CardContent className="pt-8 text-center">
  <h3 className="font-semibold text-lg mb-2 text-white">{pack.name}</h3>
  <div className="text-5xl font-bold text-primary mb-2">
    {pack.credits.toLocaleString()}
  </div>
  <p className="text-base text-white/60 mb-6">credits</p>
  <Button 
    variant="outline" 
    size="sm" 
    className="w-full"
    onClick={() => handlePricingRequest(`${pack.name} Credit Pack`)}
  >
    Get Pricing
  </Button>
</CardContent>
```

### 9. Fix FAQ Accordion Styling - Larger & Brighter Text

```tsx
<Accordion type="single" collapsible className="space-y-4">
  {faqs.map((faq, index) => (
    <AccordionItem
      key={index}
      value={`item-${index}`}
      className="bg-[#1F2227] border border-white/10 rounded-lg px-6"
    >
      <AccordionTrigger className="text-left text-lg font-medium text-white hover:no-underline py-5">
        {faq.question}
      </AccordionTrigger>
      <AccordionContent className="text-base text-white/80 pb-5">
        {faq.answer}
      </AccordionContent>
    </AccordionItem>
  ))}
</Accordion>
```

### 10. Add Pricing Request Dialog (before closing main tag)

```tsx
{/* Pricing Request Dialog */}
<Dialog open={pricingDialogOpen} onOpenChange={setPricingDialogOpen}>
  <DialogContent className="sm:max-w-lg bg-[#1F2227] border-white/10">
    <DialogHeader>
      <DialogTitle className="text-2xl text-white">
        Get {selectedPlan} Pricing
      </DialogTitle>
      <DialogDescription className="text-white/70">
        Fill out the form below and we'll send you detailed pricing information.
      </DialogDescription>
    </DialogHeader>
    <DemoRequestForm 
      source={`pricing-${selectedPlan.toLowerCase().replace(/\s+/g, '-')}`} 
      onSuccess={() => setPricingDialogOpen(false)}
    />
  </DialogContent>
</Dialog>
```

### 11. Update Feature Table Header Text Size

```tsx
<thead>
  <tr className="border-b border-white/10">
    <th className="text-left p-4 text-lg font-semibold text-white">Capability</th>
    <th className="text-center p-4 text-lg font-semibold text-white">Pilot</th>
    <th className="text-center p-4 text-lg font-semibold text-primary">Professional</th>
    <th className="text-center p-4 text-lg font-semibold text-white">Growth</th>
    <th className="text-center p-4 text-lg font-semibold text-white">Enterprise</th>
  </tr>
</thead>
```

And table body text:

```tsx
<td className="p-4 text-base text-white">{row.feature}</td>
```

---

## Visual Result

After implementation:
- No specific pricing shown (lead capture required)
- All CTAs open a dialog form instead of navigating away
- Section headings are larger (text-4xl/5xl) and brighter
- FAQ questions are `text-lg text-white` (clearly readable)
- FAQ answers are `text-base text-white/80` (good contrast)
- Feature table text is larger and more legible
- Credit packs show credits only, no dollar amounts

