# Statistical V2 Methodology

## Overview

LaunchPulse's Statistical V2 scoring engine uses weighted dimensional scoring combined with closed-won analysis to calculate fit scores. This document details the mathematical foundation and implementation of the scoring algorithm.

## Core Algorithm

### Weighted Dimensional Scoring

```
Overall Fit Score = Σ(dimension_score × dimension_weight)

Where:
- dimension_score: 0-100 score for each dimension
- dimension_weight: Statistical weight (0-1, sum = 1.0)
```

## Dimensional Scoring

### Company Size Score
```
score = 100 - abs(target_midpoint - actual) / range_size × 100
```

### Industry Score
- Exact match: 100
- Sub-industry: 85
- Related: 65
- Different: 25

### Geography Score
- Country + Region: 100
- Country only: 85
- Continent: 60
- Different: 20

## Feature Weight Calculation

Weights derived from closed-won correlation analysis using Pearson correlation coefficient.

**Last Updated**: 2024-01-15
