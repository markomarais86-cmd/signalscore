# UI Spacing Standardization Guide

This document defines the consistent spacing standards used throughout the LaunchPulse application.

## Spacing Scale

We use Tailwind's spacing scale (multiplied by 0.25rem or 4px):
- `gap-2` / `p-2` / `space-y-2` = 8px (Tight - Dense layouts, badges)
- `gap-3` / `p-3` / `space-y-3` = 12px (Compact - Nested cards, list items)
- `gap-4` / `p-4` / `space-y-4` = 16px (Standard - Default card content, sections)
- `gap-6` / `p-6` / `space-y-6` = 24px (Comfortable - Page layouts, major sections)
- `gap-8` / `p-8` / `space-y-8` = 32px (Spacious - Hero sections, major dividers)

## Component Standards

### Cards

**Top-Level Cards:**
```tsx
<Card>
  <CardHeader className="pb-4">  {/* Always pb-4 */}
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">  {/* Always space-y-4 */}
    {/* Content */}
  </CardContent>
</Card>
```

**Nested/Compact Cards:**
```tsx
<Card>
  <CardContent className="p-4 space-y-3">  {/* p-4 for padding, space-y-3 for internal spacing */}
    {/* Compact content */}
  </CardContent>
</Card>
```

### Page Layouts

**All page containers:**
```tsx
<div className="container mx-auto p-6 space-y-6">
  {/* Page content */}
</div>
```

### Grids

**Hero Metrics Grid:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
  {/* Hero metric cards */}
</div>
```

**Main Content Grid:**
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  {/* Main content cards */}
</div>
```

**Dense/Compact Grid:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
  {/* Compact items like risk tiles */}
</div>
```

### Tables

**All table cells:**
```tsx
<td className="p-3">  {/* Always p-3 */}
  {/* Cell content */}
</td>
```

### Sections Within Cards

**Standard Section Spacing:**
```tsx
<CardContent className="space-y-4">
  <div className="space-y-2">  {/* Grouped items */}
    {/* Related items */}
  </div>
  
  <div className="pt-4 border-t">  {/* Section divider */}
    {/* New section */}
  </div>
</CardContent>
```

**Compact Section Spacing:**
```tsx
<CardContent className="space-y-3">
  <div className="space-y-2">
    {/* Dense layout */}
  </div>
</CardContent>
```

## When to Use Each Spacing Value

### gap-2 / space-y-2 (8px)
- Inline badges and icons
- Tightly grouped related items
- Chip/pill lists
- Icon-text pairs

### gap-3 / space-y-3 (12px)
- Nested card content
- List items in compact views
- Risk/warning tiles
- Form field groups in tight layouts

### gap-4 / space-y-4 (16px) ⭐ DEFAULT
- **Card content spacing** (most common)
- **Section spacing within cards**
- Standard grids
- Form sections
- Most dashboard cards

### gap-6 / space-y-6 (24px)
- **Page-level layout spacing**
- Major section divisions
- Large content grids
- Between major dashboard sections

### gap-8 / space-y-8 (32px)
- Hero sections
- Marketing pages
- Major page divisions
- Use sparingly for maximum impact

## Common Patterns

### Card with Multiple Sections:
```tsx
<Card>
  <CardHeader className="pb-4">
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Section 1 */}
    <div className="space-y-2">
      <h3>Subsection</h3>
      <p>Content</p>
    </div>
    
    {/* Section 2 */}
    <div className="pt-4 border-t space-y-2">
      <h3>Another Section</h3>
      <p>Content</p>
    </div>
  </CardContent>
</Card>
```

### Grid of Cards:
```tsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <Card>
    <CardHeader className="pb-4">...</CardHeader>
    <CardContent className="space-y-4">...</CardContent>
  </Card>
  <Card>
    <CardHeader className="pb-4">...</CardHeader>
    <CardContent className="space-y-4">...</CardContent>
  </Card>
</div>
```

### Nested Cards Pattern:
```tsx
<Card>
  <CardHeader className="pb-4">
    <CardTitle>Parent Card</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Compact nested content */}
      </CardContent>
    </Card>
  </CardContent>
</Card>
```

## Benefits

1. **Visual Consistency** - Users experience predictable spacing throughout the app
2. **Easier Maintenance** - Developers know exactly which value to use
3. **Better Hierarchy** - Clear visual separation between elements
4. **Faster Development** - No time wasted deciding on spacing values
5. **Cleaner Code** - Fewer one-off custom values

## Code Review Checklist

- [ ] All CardHeaders use `pb-4`
- [ ] All CardContent use `space-y-4` (or `space-y-3` for nested cards)
- [ ] Page containers use `p-6 space-y-6`
- [ ] Hero metric grids use `gap-4`
- [ ] Main content grids use `gap-6`
- [ ] Table cells use `p-3`
- [ ] Section dividers use `pt-4 border-t`
- [ ] No custom spacing values (mx-5, gap-7, etc.)
