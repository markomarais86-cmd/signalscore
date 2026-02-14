
# Enrich Industry Templates with Missing Fields

## What Changes

Add new fields to three existing industry templates in `src/components/settings/CustomAttributeManager.tsx`:

### SaaS / Technology (add 3 fields)
- **ARR** (`arr`) -- number field, enrichment prompt asks for Annual Recurring Revenue
- **MRR** (`mrr`) -- number field, enrichment prompt asks for Monthly Recurring Revenue
- **Churn Rate** (`churn_rate`) -- number field, enrichment prompt asks for annual customer churn rate as a percentage

### Manufacturing (add 1 field)
- **Annual Output** (`annual_output`) -- number field, enrichment prompt asks for annual production output or units manufactured

### Retail and E-commerce (add 1 field)
- **Average Basket Size** (`average_basket_size`) -- number field, enrichment prompt asks for average order/basket value in USD

## Technical Detail

All changes are in a single file: `src/components/settings/CustomAttributeManager.tsx`, lines 52-77.

**SaaS fields array** (line 52-57): Append 3 new objects after `integration_count`:
```typescript
{ field_key: 'arr', field_label: 'Annual Recurring Revenue (ARR)', field_type: 'number', options: [], category: 'SaaS', enrichment_prompt: 'What is this company\'s estimated Annual Recurring Revenue (ARR) in USD?' },
{ field_key: 'mrr', field_label: 'Monthly Recurring Revenue (MRR)', field_type: 'number', options: [], category: 'SaaS', enrichment_prompt: 'What is this company\'s estimated Monthly Recurring Revenue (MRR) in USD?' },
{ field_key: 'churn_rate', field_label: 'Churn Rate (%)', field_type: 'number', options: [], category: 'SaaS', enrichment_prompt: 'What is this SaaS company\'s estimated annual customer churn rate as a percentage?' },
```

**Manufacturing fields array** (line 63-67): Append 1 new object after `production_type`:
```typescript
{ field_key: 'annual_output', field_label: 'Annual Output', field_type: 'number', options: [], category: 'Manufacturing', enrichment_prompt: 'What is this manufacturer\'s estimated annual production output or volume?' },
```

**Retail fields array** (line 73-77): Append 1 new object after `distribution_channels`:
```typescript
{ field_key: 'average_basket_size', field_label: 'Average Basket Size ($)', field_type: 'number', options: [], category: 'Retail', enrichment_prompt: 'What is this retailer\'s average order or basket size in USD?' },
```

No database migrations or other file changes needed -- these are just template definitions that get inserted into `custom_attribute_definitions` when a user clicks "Apply".
