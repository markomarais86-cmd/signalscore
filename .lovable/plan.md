
# Expand Title Normalization Mappings

## Overview
Add comprehensive title normalization mappings to standardize job titles for better ICP matching and persona analysis. This builds on the existing 35+ mappings with 60+ additional variations.

---

## Current State
The `TITLE_NORMALIZATION_MAP` in `provider-waterfall.ts` (lines 370-432) currently handles:
- Owner/Proprietor variants
- Founder/Co-Founder variants  
- C-Suite (CEO, CTO, CFO, COO, CMO, CRO)
- VP variants (Engineering, Marketing, Sales)
- Partner variants
- Director variants

---

## New Mappings to Add

### VP & Vice President Variants
| Input | Normalized Output |
|-------|-------------------|
| `vice president of sales` | VP of Sales |
| `vice president, sales` | VP of Sales |
| `vp, sales` | VP of Sales |
| `vice president of marketing` | VP of Marketing |
| `vice president, marketing` | VP of Marketing |
| `vp, marketing` | VP of Marketing |
| `vp product` | VP of Product |
| `vp of product` | VP of Product |
| `vice president of product` | VP of Product |
| `vp operations` | VP of Operations |
| `vp of operations` | VP of Operations |
| `vice president of operations` | VP of Operations |
| `vp business development` | VP of Business Development |
| `vp of business development` | VP of Business Development |
| `vp customer success` | VP of Customer Success |
| `vp of customer success` | VP of Customer Success |

### Head of Variants
| Input | Normalized Output |
|-------|-------------------|
| `head of sales` | Head of Sales |
| `head of marketing` | Head of Marketing |
| `head of engineering` | Head of Engineering |
| `head of product` | Head of Product |
| `head of operations` | Head of Operations |
| `head of hr` | Head of HR |
| `head of human resources` | Head of HR |
| `head of finance` | Head of Finance |
| `head of growth` | Head of Growth |
| `head of customer success` | Head of Customer Success |
| `head of business development` | Head of Business Development |

### Lead/Principal/Staff Developer Variants
| Input | Normalized Output |
|-------|-------------------|
| `lead developer` | Lead Developer |
| `lead software developer` | Lead Developer |
| `lead engineer` | Lead Engineer |
| `lead software engineer` | Lead Engineer |
| `principal engineer` | Principal Engineer |
| `principal software engineer` | Principal Engineer |
| `staff engineer` | Staff Engineer |
| `staff software engineer` | Staff Engineer |
| `senior developer` | Senior Developer |
| `senior software developer` | Senior Developer |
| `senior engineer` | Senior Engineer |
| `senior software engineer` | Senior Engineer |
| `tech lead` | Tech Lead |
| `technical lead` | Tech Lead |
| `engineering lead` | Engineering Lead |
| `development lead` | Development Lead |

### Manager Variants
| Input | Normalized Output |
|-------|-------------------|
| `general manager` | General Manager |
| `operations manager` | Operations Manager |
| `sales manager` | Sales Manager |
| `marketing manager` | Marketing Manager |
| `product manager` | Product Manager |
| `project manager` | Project Manager |
| `program manager` | Program Manager |
| `account manager` | Account Manager |
| `customer success manager` | Customer Success Manager |
| `engineering manager` | Engineering Manager |
| `development manager` | Development Manager |
| `it manager` | IT Manager |
| `hr manager` | HR Manager |
| `human resources manager` | HR Manager |
| `office manager` | Office Manager |
| `regional manager` | Regional Manager |
| `branch manager` | Branch Manager |

### Additional C-Suite & Executive Variants
| Input | Normalized Output |
|-------|-------------------|
| `chief product officer` | CPO |
| `cpo` | CPO |
| `chief people officer` | Chief People Officer |
| `chief human resources officer` | CHRO |
| `chro` | CHRO |
| `chief information officer` | CIO |
| `cio` | CIO |
| `chief security officer` | CSO |
| `cso` | CSO |
| `chief data officer` | CDO |
| `cdo` | CDO |
| `chief digital officer` | Chief Digital Officer |
| `chief strategy officer` | Chief Strategy Officer |
| `chief growth officer` | Chief Growth Officer |
| `chief commercial officer` | CCO |
| `cco` | CCO |
| `chief customer officer` | Chief Customer Officer |
| `executive vice president` | EVP |
| `evp` | EVP |
| `senior vice president` | SVP |
| `svp` | SVP |

### Additional Director Variants
| Input | Normalized Output |
|-------|-------------------|
| `director of product` | Product Director |
| `director of it` | IT Director |
| `director of information technology` | IT Director |
| `director of customer success` | Customer Success Director |
| `director of business development` | Business Development Director |
| `director of growth` | Growth Director |
| `creative director` | Creative Director |
| `art director` | Art Director |
| `technical director` | Technical Director |
| `managing director` | Managing Director |
| `executive director` | Executive Director |

### Consultant & Advisor Variants
| Input | Normalized Output |
|-------|-------------------|
| `consultant` | Consultant |
| `senior consultant` | Senior Consultant |
| `principal consultant` | Principal Consultant |
| `management consultant` | Management Consultant |
| `advisor` | Advisor |
| `senior advisor` | Senior Advisor |
| `strategic advisor` | Strategic Advisor |
| `board advisor` | Board Advisor |
| `board member` | Board Member |

---

## File to Modify

| File | Changes |
|------|---------|
| `supabase/functions/_shared/provider-waterfall.ts` | Expand `TITLE_NORMALIZATION_MAP` (lines 370-432) with ~70 new mappings |

---

## Implementation Details

The mappings will be organized into clear sections within the existing map:
1. Owner variants (existing)
2. Founder variants (existing)
3. C-Suite variants (expanded)
4. VP variants (expanded)
5. Head of variants (new)
6. Lead/Principal/Staff variants (new)
7. Manager variants (new)
8. Director variants (expanded)
9. Partner variants (existing)
10. Consultant & Advisor variants (new)

---

## Testing

After implementation, verify with these test cases:
- `"VP Sales"` → `"VP of Sales"`
- `"head of engineering"` → `"Head of Engineering"`
- `"lead developer"` → `"Lead Developer"`
- `"senior software engineer"` → `"Senior Engineer"`
- `"chief product officer"` → `"CPO"`
- `"customer success manager"` → `"Customer Success Manager"`
