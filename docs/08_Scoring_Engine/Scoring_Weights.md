# Scoring Weights

## Overview

Feature weights determine the relative importance of each dimension in the overall fit score calculation.

## Default Weights

| Dimension | Default Weight | Range |
|-----------|----------------|-------|
| Company Size | 0.25 | 0.0-1.0 |
| Industry | 0.25 | 0.0-1.0 |
| Geography | 0.20 | 0.0-1.0 |
| Revenue | 0.15 | 0.0-1.0 |
| Tech Stack | 0.10 | 0.0-1.0 |
| Funding | 0.05 | 0.0-1.0 |

**Total**: Must sum to 1.0

## Auto-Calculated Weights

LaunchPulse can derive weights from closed-won correlation analysis:

1. Upload 50+ closed-won deals
2. Run correlation analysis
3. Calculate weights based on correlation strength
4. Review and apply

## Manual Weight Adjustment

Adjust weights in Settings → Scoring → Feature Weights based on:
- Business priorities
- Product changes
- Market focus shifts
- Sales team feedback

**Last Updated**: 2024-01-15
