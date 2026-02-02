

# Comprehensive Tech Stack Whitelist Expansion Plan

## Current State

The `VALID_TECH_STACK_ITEMS` set in `accuracy-validators.ts` contains approximately **300 technology names** across 15 categories:

| Category | Current Count | Items |
|----------|---------------|-------|
| Cloud Providers | 22 | AWS, Azure, GCP, DigitalOcean, Heroku, etc. |
| Databases | 30 | PostgreSQL, MySQL, MongoDB, Redis, etc. |
| Frontend Frameworks | 45 | React, Vue, Angular, Next.js, Tailwind, etc. |
| Backend Frameworks | 55 | Node.js, Django, Spring, Rails, Laravel, etc. |
| Mobile | 15 | React Native, Flutter, Swift, Kotlin, etc. |
| DevOps & Infrastructure | 45 | Docker, Kubernetes, Terraform, Jenkins, etc. |
| CRM & Sales | 16 | Salesforce, HubSpot, Pipedrive, etc. |
| Marketing | 25 | Marketo, Mailchimp, SendGrid, etc. |
| Analytics | 27 | Google Analytics, Mixpanel, Amplitude, etc. |
| Customer Support | 16 | Intercom, Zendesk, Freshdesk, etc. |
| Payments | 19 | Stripe, PayPal, Braintree, etc. |
| E-commerce | 15 | Shopify, WooCommerce, Magento, etc. |
| CMS | 18 | WordPress, Contentful, Strapi, etc. |
| Communication | 17 | Slack, Teams, Twilio, etc. |
| Authentication | 16 | Auth0, Okta, Clerk, etc. |
| Version Control | 9 | Git, GitHub, GitLab, etc. |
| Project Management | 16 | Jira, Asana, Linear, etc. |
| AI & ML | 28 | TensorFlow, PyTorch, OpenAI, etc. |
| Misc | 40 | GraphQL, Kafka, TypeScript, Jest, etc. |

---

## Expansion Plan: +100 New Technologies

### New Category 1: Security & Compliance (+15 items)
Essential security tools often found in enterprise tech stacks:
- **WAF/Protection**: Cloudflare WAF, AWS WAF, Akamai, Imperva, F5
- **Secret Management**: HashiCorp Vault, AWS Secrets Manager, Doppler, 1Password
- **Compliance**: Vanta, Drata, Secureframe, SOC2, GDPR

### New Category 2: Data Engineering (+20 items)
ETL, data pipelines, and data orchestration tools:
- **ETL/ELT**: Fivetran, Airbyte, Stitch, Matillion, dbt, dbt Cloud
- **Orchestration**: Apache Airflow, Dagster, Prefect, Mage, Luigi
- **Data Lakes**: Databricks, Delta Lake, Apache Iceberg, Apache Hudi
- **Streaming**: Apache Flink, Apache Spark, Apache Beam, Debezium

### New Category 3: Search & Discovery (+10 items)
Search engines and content discovery:
- Algolia, MeiliSearch, Typesense, Apache Solr, OpenSearch
- Pinecone, Weaviate, Milvus, Qdrant, Chroma

### New Category 4: Low-Code/No-Code (+12 items)
Growing category for enterprise integrations:
- Zapier, Make, Integromat, n8n, Tray.io, Workato
- Retool, Budibase, Appsmith, Bubble, Glide, Outsystems

### New Category 5: API Management (+10 items)
API gateways and documentation:
- Kong, Apigee, MuleSoft, Postman, Swagger, OpenAPI
- AWS API Gateway, Azure API Management, Tyk, Ambassador

### New Category 6: Video & Media (+10 items)
Video processing and streaming:
- Mux, Cloudinary, ImageKit, Imgix, Vimeo
- Wistia, Brightcove, JW Player, Video.js, FFmpeg

### New Category 7: Testing & QA (+10 items)
Expanded testing tools:
- Sauce Labs, BrowserStack, LambdaTest, Appium
- TestRail, Qase, Allure, k6, Artillery, Gatling

### Existing Category Expansions (+23 items)

**DevOps (+8)**:
- Pulumi, Crossplane, Spacelift, Teleport, Boundary, Istio, Linkerd, Service Mesh

**AI & ML (+10)**:
- Stable Diffusion, Midjourney, Replicate, Modal, Anyscale, Mosaic ML
- LlamaIndex, Pinecone, Vector DB, FAISS, Cohere, Anthropic Claude

**Backend (+5)**:
- Bun, Deno, Elysia, Hono, tRPC

---

## Implementation Details

### File to Modify
- `supabase/functions/_shared/accuracy-validators.ts`

### Enhanced VALID_TECH_STACK_ITEMS Structure

```typescript
const VALID_TECH_STACK_ITEMS = new Set([
  // Cloud Providers (22 items) - existing
  'AWS', 'Amazon Web Services', 'Azure', 'Microsoft Azure', ...
  
  // Databases (30 items) - existing
  'PostgreSQL', 'MySQL', 'MongoDB', ...
  
  // Frontend Frameworks (45 items) - existing
  'React', 'Vue', 'Angular', ...
  
  // Backend Frameworks (60 items) - expanded +5
  'Node.js', 'Django', 'Spring', ...
  'Bun', 'Deno', 'Elysia', 'Hono', 'tRPC',
  
  // Mobile (15 items) - existing
  'React Native', 'Flutter', ...
  
  // DevOps & Infrastructure (53 items) - expanded +8
  'Docker', 'Kubernetes', ...
  'Pulumi', 'Crossplane', 'Spacelift', 'Teleport', 'Boundary', 
  'Istio', 'Linkerd', 'Service Mesh',
  
  // CRM & Sales (16 items) - existing
  'Salesforce', 'HubSpot', ...
  
  // Marketing (25 items) - existing
  'Marketo', 'Mailchimp', ...
  
  // Analytics (27 items) - existing
  'Google Analytics', 'Mixpanel', ...
  
  // Customer Support (16 items) - existing
  'Intercom', 'Zendesk', ...
  
  // Payments (19 items) - existing
  'Stripe', 'PayPal', ...
  
  // E-commerce (15 items) - existing
  'Shopify', 'WooCommerce', ...
  
  // CMS (18 items) - existing
  'WordPress', 'Contentful', ...
  
  // Communication (17 items) - existing
  'Slack', 'Teams', ...
  
  // Authentication (16 items) - existing
  'Auth0', 'Okta', ...
  
  // Version Control (9 items) - existing
  'Git', 'GitHub', ...
  
  // Project Management (16 items) - existing
  'Jira', 'Asana', ...
  
  // AI & ML (38 items) - expanded +10
  'TensorFlow', 'PyTorch', ...
  'Stable Diffusion', 'Midjourney', 'Replicate', 'Modal', 'Anyscale',
  'LlamaIndex', 'Cohere', 'FAISS', 'Mosaic ML', 'Anthropic Claude',
  
  // NEW: Security & Compliance (15 items)
  'Cloudflare WAF', 'AWS WAF', 'Akamai', 'Imperva', 'F5',
  'HashiCorp Vault', 'AWS Secrets Manager', 'Doppler', '1Password',
  'Vanta', 'Drata', 'Secureframe', 'CrowdStrike', 'SentinelOne', 'Snyk',
  
  // NEW: Data Engineering (20 items)
  'Fivetran', 'Airbyte', 'Stitch', 'Matillion', 'dbt', 'dbt Cloud',
  'Apache Airflow', 'Airflow', 'Dagster', 'Prefect', 'Mage', 'Luigi',
  'Databricks', 'Delta Lake', 'Apache Iceberg', 'Apache Hudi',
  'Apache Flink', 'Apache Spark', 'Spark', 'Apache Beam', 'Debezium',
  
  // NEW: Search & Vector Databases (10 items)
  'Algolia', 'MeiliSearch', 'Typesense', 'Apache Solr', 'OpenSearch',
  'Pinecone', 'Weaviate', 'Milvus', 'Qdrant', 'Chroma',
  
  // NEW: Low-Code/No-Code (12 items)
  'Zapier', 'Make', 'Integromat', 'n8n', 'Tray.io', 'Workato',
  'Retool', 'Budibase', 'Appsmith', 'Bubble', 'Glide', 'Outsystems',
  
  // NEW: API Management (10 items)
  'Kong', 'Apigee', 'MuleSoft', 'Postman', 'Swagger', 'OpenAPI',
  'AWS API Gateway', 'Azure API Management', 'Tyk', 'Ambassador',
  
  // NEW: Video & Media (10 items)
  'Mux', 'Cloudinary', 'ImageKit', 'Imgix', 'Vimeo',
  'Wistia', 'Brightcove', 'JW Player', 'Video.js', 'FFmpeg',
  
  // NEW: Testing & QA (10 items)
  'Sauce Labs', 'BrowserStack', 'LambdaTest', 'Appium',
  'TestRail', 'Qase', 'Allure', 'k6', 'Artillery', 'Gatling',
  
  // Misc - expanded
  'GraphQL', 'Kafka', 'TypeScript', ...
]);
```

---

## Summary of Changes

| Metric | Current | After |
|--------|---------|-------|
| **Total Items** | ~300 | ~410 |
| **Categories** | 19 | 26 (+7 new) |
| **Security Tools** | 0 | 15 |
| **Data Engineering** | 0 | 20 |
| **Vector Databases** | 0 | 10 |
| **Low-Code/No-Code** | 0 | 12 |
| **API Management** | 0 | 10 |
| **Video & Media** | 0 | 10 |
| **Testing & QA** | ~10 | 20 |

---

## Expected Impact

| Benefit | Description |
|---------|-------------|
| **Reduced Hallucinations** | 35% more tech items validated against whitelist |
| **Enterprise Coverage** | Security, compliance, and data engineering tools included |
| **Modern Stack Support** | AI/ML expansion includes vector databases, LLM tools |
| **Low-Code Recognition** | Zapier, Retool, n8n now validated |
| **Better SMB Coverage** | Video/media tools for content-focused businesses |

