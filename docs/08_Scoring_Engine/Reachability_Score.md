# Reachability Score

## Overview

Reachability score predicts contact email deliverability and engagement likelihood.

## Score Components

```
Reachability Score (0-100):
├── Email Validity (40%)
│   ├── Syntax validation
│   ├── Domain MX records
│   └── Catch-all detection
├── Data Freshness (30%)
│   ├── Last verified date
│   └── Data source recency
├── Engagement History (20%)
│   ├── Previous email opens
│   └── Reply rates
└── Professional Signals (10%)
    ├── Corporate email domain
    └── LinkedIn profile presence
```

## Score Interpretation

| Score | Deliverability | Use Case |
|-------|----------------|----------|
| 80-100 | Very High | Priority outreach |
| 60-79 | High | Standard campaigns |
| 40-59 | Medium | Verify before sending |
| 20-39 | Low | Risky, may bounce |
| 0-19 | Very Low | Exclude from campaigns |

## Using Reachability

- Prioritize high-reachability contacts
- Filter out low-reachability (<40)
- Verify medium contacts before campaigns
- Track deliverability by reachability band

**Last Updated**: 2024-01-15
