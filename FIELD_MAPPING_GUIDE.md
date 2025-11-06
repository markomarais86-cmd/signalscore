# Field Mapping Guide

## Overview

Field mapping allows you to customize how data from external systems (CRMs, enrichment providers) maps to your database schema. This guide covers how to configure and manage field mappings across all integrations.

**Version:** 1.0  
**Last Updated:** 2025-11-06

---

## Standard Field Mappings

These mappings are automatic and work out-of-the-box:

### CRM → Accounts Table
| CRM Field | Your Field | Notes |
|-----------|------------|-------|
| Name | name | Company name |
| Website | domain | Auto-normalized |
| Industry | industry | Auto-normalized |
| Phone | phone | Phone number |
| BillingStreet | address | Street address |
| BillingCity | city | City |
| BillingState | state_province | State/Province |
| BillingCountry | country | Country |
| NumberOfEmployees | employee_count | Employee count |

### CRM → Leads Table
| CRM Field | Your Field | Notes |
|-----------|------------|-------|
| FirstName | first_name | First name |
| LastName | last_name | Last name |
| Email | email | Email address |
| Title | title | Job title |
| Phone | phone | Phone number |
| Company | company | Company name |

---

## Custom Field Mapping

### Via UI (Recommended)
1. **Settings** → **External Integrations** → **[Integration]**
2. Click **"Field Mapping"**
3. Drag source field to target field
4. Click **"Save Mappings"**

### Via Database (Advanced)
Stored in `integration_configs.config.field_mappings`:

```json
{
  "field_mappings": {
    "Account": {
      "Annual_Revenue__c": "revenue_range",
      "Tech_Stack__c": "technologies",
      "ICP_Score__c": "propensity_score"
    },
    "Contact": {
      "LinkedIn_URL__c": "linkedin_url",
      "Persona__c": "persona"
    }
  }
}
```

---

## Best Practices

1. **Map all standard fields first** before custom fields
2. **Test with single record** before bulk sync
3. **Document custom mappings** in a spreadsheet
4. **Review after CRM changes** to ensure fields still exist
5. **Use consistent naming** across systems

---

**Last Updated:** 2025-11-06
