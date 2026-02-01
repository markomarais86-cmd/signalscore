

## Overview

This plan improves the feature card icons on the landing page and adds a 4th "Enrichment" feature tile to create a more polished and complete feature showcase.

## What We're Changing

### 1. Replace External SVG Icons with Styled Lucide Icons

Currently, the feature cards use external image URLs for icons. We'll replace these with Lucide React icons that are styled to match the current design aesthetic (primary color with subtle background).

**New icon mapping:**
- AI ICP Builder: `Target` icon (bullseye/crosshair represents precision targeting)
- TAM Generator: `BarChart3` icon (chart represents market sizing/analytics)
- CRM Insight Layer: `Users` icon (represents customer/persona insights)
- Data Enrichment: `Zap` icon (represents the fast, powerful enrichment engine)

### 2. Add 4th Feature Card: Data Enrichment

New enrichment feature card with content based on the Product page:
- **Title:** "Data Enrichment"
- **Description:** "AI-powered enrichment waterfall verifies data across multiple premium sources to deliver highest accuracy at a fraction of competitor costs."

### 3. Update Grid Layout

Change the grid from 3 columns to 4 columns on larger screens to accommodate the new tile, or optionally use a 2x2 grid for balanced appearance.

---

## Technical Details

### Files to Modify

**src/pages/Landing.tsx**

1. Import Lucide icons at the top:
   ```tsx
   import { Target, BarChart3, Users, Zap } from "lucide-react";
   ```

2. Update the `features` array to use Lucide icons instead of iconUrl:
   ```tsx
   const features = [
     {
       icon: Target,
       title: "AI ICP Builder",
       description: "Define and validate your ICP using real conversion patterns from your CRM—so targeting is based on evidence, not internal opinion.",
     },
     {
       icon: BarChart3,
       title: "TAM Generator",
       description: "Generate a dynamic, segmentable TAM that stays aligned to your ICP and can be operationalised by territory, industry, size band, region, and buyer persona.",
     },
     {
       icon: Users,
       title: "CRM Insight Layer",
       description: "Diagnose pipeline misalignment by surfacing data quality risk, persona coverage gaps, segment leakage, and where GTM effort is being misallocated.",
     },
     {
       icon: Zap,
       title: "Data Enrichment",
       description: "AI-powered enrichment waterfall verifies data across multiple premium sources to deliver highest accuracy at a fraction of competitor costs.",
     },
   ];
   ```

3. Update the grid layout for 4 cards:
   ```tsx
   <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
   ```

4. Update the FeatureCard usage to pass `icon` instead of `iconUrl`:
   ```tsx
   <FeatureCard
     key={index}
     icon={feature.icon}
     title={feature.title}
     description={feature.description}
     delay={0.1 * index}
   />
   ```

---

## Visual Result

The landing page will display 4 feature cards in a row on desktop:
1. **AI ICP Builder** - Target icon
2. **TAM Generator** - BarChart3 icon
3. **CRM Insight Layer** - Users icon  
4. **Data Enrichment** - Zap icon (NEW)

Each icon will render as a Lucide icon inside the existing styled container (rounded box with primary color background), providing consistent styling across all cards while eliminating external image dependencies.

