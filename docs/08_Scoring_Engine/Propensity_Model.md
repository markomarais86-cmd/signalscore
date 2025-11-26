# Propensity Model

## Overview

The propensity model predicts conversion likelihood using machine learning trained on historical closed-won deals.

## Model Architecture

**Type**: Gradient Boosted Trees (XGBoost)

**Features**:
- Firmographic data (size, industry, geography)
- Fit score dimensions
- Intent signals (funding, hiring, tech changes)
- Engagement metrics
- Temporal features

## Training Requirements

- Minimum: 100 closed-won deals
- Recommended: 500+ deals
- Retrain frequency: Weekly or monthly

## Model Performance

Metrics tracked:
- Accuracy
- Precision/Recall
- AUC-ROC
- Feature importance

## Propensity Score Interpretation

| Score | Conversion Likelihood |
|-------|----------------------|
| 80-100 | Very High (>25%) |
| 60-79 | High (15-25%) |
| 40-59 | Medium (8-15%) |
| 20-39 | Low (3-8%) |
| 0-19 | Very Low (<3%) |

**Last Updated**: 2024-01-15
