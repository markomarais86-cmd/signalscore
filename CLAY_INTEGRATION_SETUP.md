# Clay Integration Setup Guide

## Overview

Integrate Clay with your ICP platform to automatically sync enriched company and contact data via Zapier webhooks.

**Version:** 1.0  
**Last Updated:** 2025-01-27

---

## Architecture

**Data Flow:**
```
Clay Table → Zapier (Webhook Trigger) → Your App (clay-webhook-receiver) → Database
```

---

## Setup Steps

### 1. Configure Field Mappings

1. Navigate to **Settings** → **Zapier Integration**
2. Scroll to **Clay Field Mapping** section
3. Select data type (Company or Contact)
4. Map Clay fields to your database fields
5. Click **Save Mappings**

**Default Company Mappings:**
- `company_name` → Company Name
- `domain` → Domain
- `industry` → Industry
- `employee_count` → Employee Count
- `revenue` → Revenue Range
- `location` → Country
- `technologies` → Tech Stack

**Default Contact Mappings:**
- `email` → Email
- `first_name` → First Name
- `last_name` → Last Name
- `title` → Job Title
- `company_domain` → Company
- `linkedin_url` → LinkedIn URL

---

### 2. Get Your Webhook URL

Your unique webhook URL is:
```
https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/clay-webhook-receiver
```

**Important:** Include your organization ID in the request:
- Add `x-org-id` header with your org UUID, OR
- Include `org_id` in the JSON payload

---

### 3. Set Up Clay Table

1. Create a new Clay table or use existing
2. Add enrichment columns (company data, contact data, etc.)
3. Run enrichments to populate data
4. Ensure you have these required fields:
   - **For Companies:** `domain` (required)
   - **For Contacts:** `email` (required)

---

### 4. Create Zapier Workflow

#### Step 1: Create New Zap
1. Go to [Zapier](https://zapier.com)
2. Click **Create Zap**

#### Step 2: Set Up Trigger
1. Search for **Clay**
2. Select **New Row** trigger
3. Connect your Clay account
4. Select your table
5. Test trigger to confirm data

#### Step 3: Add Webhook Action
1. Click **+** to add action
2. Search for **Webhooks by Zapier**
3. Select **POST** action
4. Configure webhook:
   - **URL:** `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/clay-webhook-receiver`
   - **Payload Type:** JSON
   - **Data:** (see examples below)
   - **Headers:**
     - `Content-Type`: `application/json`
     - `x-org-id`: `YOUR_ORG_ID`

#### Step 4: Configure Payload

**For Company Data:**
```json
{
  "webhook_type": "clay_company_data",
  "org_id": "YOUR_ORG_ID",
  "data": {
    "company_name": "{{Company Name}}",
    "domain": "{{Domain}}",
    "industry": "{{Industry}}",
    "employee_count": "{{Employee Count}}",
    "revenue": "{{Revenue}}",
    "location": "{{Location}}",
    "technologies": "{{Technologies}}"
  },
  "idempotency_key": "{{Row ID}}"
}
```

**For Contact Data:**
```json
{
  "webhook_type": "clay_contact_data",
  "org_id": "YOUR_ORG_ID",
  "data": {
    "email": "{{Email}}",
    "first_name": "{{First Name}}",
    "last_name": "{{Last Name}}",
    "title": "{{Title}}",
    "company_domain": "{{Company Domain}}",
    "linkedin_url": "{{LinkedIn URL}}",
    "phone": "{{Phone}}"
  },
  "idempotency_key": "{{Row ID}}"
}
```

**For Enrichment Updates:**
```json
{
  "webhook_type": "clay_enrichment_data",
  "org_id": "YOUR_ORG_ID",
  "data": {
    "domain": "{{Domain}}",
    "employee_count": "{{Employee Count}}",
    "revenue": "{{Revenue}}",
    "industry": "{{Industry}}",
    "technologies": "{{Technologies}}",
    "funding_round": "{{Last Funding Round}}",
    "total_funding": "{{Total Funding}}"
  },
  "idempotency_key": "{{Row ID}}"
}
```

#### Step 5: Test & Enable
1. Click **Test action** in Zapier
2. Verify data appears in your app
3. Check webhook logs in Settings
4. Turn on Zap

---

## Finding Your Org ID

1. Go to **Settings** → **Zapier Integration**
2. Your Org ID is displayed at the top
3. Copy and use in webhook configuration

---

## Webhook Types

### 1. clay_company_data
Creates or updates accounts/companies in your database.

**Required Field:** `domain`

**Action Logic:**
- If domain exists → Update account
- If domain is new → Create account
- All fields mapped via field mapping config

### 2. clay_contact_data
Creates or updates contacts/leads in your database.

**Required Field:** `email`

**Action Logic:**
- If email exists → Update lead
- If email is new → Create lead
- Auto-links to account if `company_domain` matches

### 3. clay_enrichment_data
Updates existing accounts with new enrichment data.

**Required Field:** `domain` or `account_id`

**Action Logic:**
- Finds existing account
- Updates enrichment fields
- Does not create new accounts

---

## Monitoring & Logs

### View Webhook Activity
1. Go to **Settings** → **Zapier Integration**
2. Scroll to **Incoming Webhooks** section
3. View recent webhook logs
4. Check processing status
5. Review any errors

### Log Fields
- **Timestamp:** When webhook was received
- **Type:** clay_company_data, clay_contact_data, etc.
- **Status:** Processed, Error
- **Action:** Created, Updated, Enriched
- **Error:** Error message (if failed)

---

## Troubleshooting

### Webhook Not Receiving Data
- ✅ Check webhook URL is correct
- ✅ Verify `x-org-id` header is set
- ✅ Confirm Zap is turned on
- ✅ Check Zapier task history for errors

### Data Not Appearing
- ✅ Verify field mappings are correct
- ✅ Check required fields are present (`domain` or `email`)
- ✅ Review webhook logs for errors
- ✅ Ensure data types match (numbers, strings, arrays)

### Duplicate Records
- ✅ Use `idempotency_key` in payload (e.g., Clay Row ID)
- ✅ System automatically prevents duplicates with same key
- ✅ Check domain/email matching logic

### Account Linking Issues
- ✅ Ensure `company_domain` is provided for contacts
- ✅ Domain must match exactly (normalized automatically)
- ✅ Create account first before syncing contacts

---

## Best Practices

### 1. Field Naming
- Use consistent field names in Clay
- Match field names to your database schema
- Use custom mappings for non-standard fields

### 2. Data Quality
- Clean data in Clay before syncing
- Normalize domains (remove http://, www.)
- Validate emails before sending
- Use consistent formatting

### 3. Batch Processing
- Process rows in batches (max 100 per minute)
- Add delays in Zapier if hitting rate limits
- Monitor webhook logs for failures

### 4. Error Handling
- Check webhook logs daily
- Set up Zapier error notifications
- Retry failed webhooks manually
- Keep field mappings up to date

### 5. Testing
- Test with single row first
- Verify data appears correctly
- Check all field mappings
- Test different webhook types

---

## Advanced Configuration

### Custom Field Mappings
1. Add custom Clay field in mapping UI
2. Select target database field
3. Save mappings
4. Update Zapier payload to include new field

### Multiple Clay Tables
- Create separate Zaps for each table
- Use different webhook types per table
- Maintain consistent field naming
- Use idempotency keys to prevent duplicates

### Conditional Syncing
- Use Zapier filters to sync only certain rows
- Filter by status, score, or other criteria
- Reduces unnecessary webhook calls

---

## API Reference

### Webhook Endpoint
```
POST https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/clay-webhook-receiver
```

### Headers
```
Content-Type: application/json
x-org-id: YOUR_ORG_ID (optional if in payload)
```

### Request Body
```json
{
  "webhook_type": "clay_company_data" | "clay_contact_data" | "clay_enrichment_data",
  "org_id": "uuid",
  "data": {
    // Field mappings based on webhook type
  },
  "idempotency_key": "unique_identifier" // Optional but recommended
}
```

### Response
```json
{
  "success": true,
  "result": {
    "action": "created" | "updated" | "enriched",
    "account_id": "uuid" | "lead_id": "bigint"
  }
}
```

---

## Support

For issues or questions:
1. Check webhook logs in Settings
2. Review Zapier task history
3. Verify field mappings
4. Check this documentation

---

**Last Updated:** 2025-01-27
