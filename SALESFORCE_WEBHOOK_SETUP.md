# Salesforce Real-Time Webhook Setup

This guide explains how to configure Salesforce to send real-time updates to your application using either **Outbound Messages** or **Change Data Capture**.

## Webhook Endpoint URL

Your webhook endpoint is:
```
https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/salesforce-webhook
```

---

## Option 1: Outbound Messages (SOAP-based)

Outbound Messages are the traditional way to receive notifications when Salesforce records change.

### Setup Steps:

1. **Navigate to Setup** in Salesforce
   - Click the gear icon → Setup

2. **Create a Workflow Rule**
   - In Quick Find, search for "Workflow Rules"
   - Click **New Rule**
   - Select the object (Account, Contact, or Lead)
   - Name: "Sync to External System"
   - Evaluation Criteria: "Every time a record is created or edited"
   - Rule Criteria: Set to match the records you want to sync (e.g., "Formula evaluates to true" with formula "TRUE")

3. **Add Workflow Action - Outbound Message**
   - Click **Add Workflow Action** → **New Outbound Message**
   - Name: "Send Account Update"
   - Endpoint URL: `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/salesforce-webhook`
   - API Version: 58.0 (or latest)
   - Select Fields: Choose which fields to send (Id, Name, Website, Industry, etc.)
   - Check "Send Session ID"
   - Click **Save**

4. **Activate the Workflow**
   - Back on the Workflow Rule page, click **Activate**

### Test the Integration:

1. Edit any Account/Contact/Lead in Salesforce
2. Check the webhook logs in your application's Settings → Integrations
3. Verify the data was synced to your database

---

## Option 2: Change Data Capture (Modern, Event-driven)

Change Data Capture (CDC) is Salesforce's modern event-driven approach that automatically publishes events when records change.

### Setup Steps:

1. **Enable Change Data Capture**
   - In Setup, search for "Change Data Capture"
   - Click **Change Data Capture**

2. **Select Objects to Monitor**
   - Move objects from "Available Entities" to "Selected Entities":
     - AccountChangeEvent
     - ContactChangeEvent
     - LeadChangeEvent
   - Click **Save**

3. **Subscribe to Events (via Apex or Platform Events)**

   You have two options:

   **Option A: Use a Platform Event Trigger**
   
   Create a Platform Event to forward CDC events:
   
   ```apex
   // Create a Platform Event Definition in Setup
   // Name: External_Sync__e
   // Fields: Object_Type__c (Text), Record_Id__c (Text), Action__c (Text)
   ```

   Then create an Apex Trigger on Change Events:
   
   ```apex
   trigger AccountChangeTrigger on AccountChangeEvent (after insert) {
       List<External_Sync__e> events = new List<External_Sync__e>();
       
       for (AccountChangeEvent change : Trigger.New) {
           External_Sync__e evt = new External_Sync__e(
               Object_Type__c = 'Account',
               Record_Id__c = change.Id,
               Action__c = change.ChangeEventHeader.changeType
           );
           events.add(evt);
       }
       
       EventBus.publish(events);
   }
   ```

   **Option B: Use Salesforce Streaming API Client**
   
   You can subscribe to CDC events using the Salesforce Streaming API in your application (more advanced).

4. **Forward Events to Webhook**

   Create an invocable Apex method to call your webhook:
   
   ```apex
   public class WebhookHandler {
       @future(callout=true)
       public static void sendToWebhook(String recordId, String objectType, String action) {
           HttpRequest req = new HttpRequest();
           req.setEndpoint('https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/salesforce-webhook');
           req.setMethod('POST');
           req.setHeader('Content-Type', 'application/json');
           
           Map<String, Object> payload = new Map<String, Object>{
               'recordId' => recordId,
               'objectType' => objectType,
               'action' => action,
               'organizationId' => UserInfo.getOrganizationId()
           };
           
           req.setBody(JSON.serialize(payload));
           
           Http http = new Http();
           HttpResponse res = http.send(req);
       }
   }
   ```

5. **Configure Remote Site Settings**
   - Setup → Remote Site Settings
   - Click **New Remote Site**
   - Remote Site Name: "External_Webhook"
   - Remote Site URL: `https://dhyfbaptcprxxixgnpby.supabase.co`
   - Click **Save**

---

## Option 3: Platform Events (Custom)

For more control, you can create custom Platform Events.

### Setup Steps:

1. **Create Platform Event**
   - Setup → Platform Events → New Platform Event
   - Label: "Account Update Event"
   - Plural Label: "Account Update Events"
   - Object Name: "Account_Update__e"
   - Add custom fields:
     - Record_Id__c (Text, 18)
     - Object_Type__c (Text, 50)
     - Action__c (Text, 20)
     - Data__c (Text Area Long)

2. **Publish Events via Trigger**
   
   ```apex
   trigger AccountTrigger on Account (after insert, after update, after delete, after undelete) {
       List<Account_Update__e> events = new List<Account_Update__e>();
       
       String action = Trigger.isInsert ? 'created' :
                      Trigger.isUpdate ? 'updated' :
                      Trigger.isDelete ? 'deleted' : 'undeleted';
       
       List<Account> accounts = Trigger.new != null ? Trigger.new : Trigger.old;
       
       for (Account acc : accounts) {
           Account_Update__e evt = new Account_Update__e(
               Record_Id__c = acc.Id,
               Object_Type__c = 'Account',
               Action__c = action,
               Data__c = JSON.serialize(acc)
           );
           events.add(evt);
       }
       
       EventBus.publish(events);
   }
   ```

3. **Subscribe and Forward to Webhook**
   
   Use an Apex trigger on the Platform Event to forward to your webhook:
   
   ```apex
   trigger AccountUpdateEventTrigger on Account_Update__e (after insert) {
       for (Account_Update__e evt : Trigger.New) {
           WebhookHandler.sendToWebhook(
               evt.Record_Id__c,
               evt.Object_Type__c,
               evt.Action__c
           );
       }
   }
   ```

---

## Monitoring Webhooks

### View Webhook Logs

Navigate to **Settings → Integrations** in your application to view:
- All incoming webhooks
- Processing status
- Error messages
- Payload details

### Troubleshooting

**Webhooks not being received:**
1. Check Salesforce Outbound Message Delivery Status:
   - Setup → Monitoring → Outbound Messages
   - View delivery attempts and errors

2. Verify Remote Site Settings are configured

3. Check that the workflow rule is active

4. Review webhook logs in your application

**Records not syncing:**
1. Check webhook logs for error messages
2. Verify the record exists in Salesforce
3. Ensure field mappings are correct
4. Check RLS policies on your database tables

---

## Security Considerations

1. **Organization ID Validation**: The webhook validates incoming requests using the Salesforce Organization ID

2. **Session ID**: Outbound Messages include a Session ID for additional validation

3. **HTTPS**: All communication is encrypted via HTTPS

4. **IP Whitelisting** (Optional): You can configure Salesforce to only send from specific IPs

---

## Recommended Approach

For most use cases, we recommend:
- **Outbound Messages** for simplicity and ease of setup
- **Change Data Capture** for high-volume, real-time scenarios
- **Platform Events** for custom business logic and complex routing

All three methods are supported by your webhook endpoint!
