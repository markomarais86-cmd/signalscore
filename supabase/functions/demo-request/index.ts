import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.88.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface DemoRequest {
  name: string;
  email: string;
  company?: string;
  subject?: string;
  message?: string;
  source?: string;
}

function getPlanDisplayName(source: string | undefined): string | null {
  if (!source) return null;
  
  if (source.startsWith('pricing-')) {
    const planPart = source.replace('pricing-', '');
    
    if (planPart.includes('credit-pack')) {
      return planPart
        .replace('-credit-pack', '')
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') + ' Credit Pack';
    }
    
    return planPart
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' Plan';
  }
  
  return null;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: DemoRequest = await req.json();
    console.log("Received demo request:", data);

    if (!data.name || !data.email) {
      return new Response(
        JSON.stringify({ error: "Name and email are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const timestamp = new Date().toISOString();
    const planDisplayName = getPlanDisplayName(data.source);
    
    const emailSubject = planDisplayName 
      ? `New Demo Request: ${planDisplayName} - ${data.name}`
      : `New Demo Request from ${data.name}`;

    const selectedPlanRow = planDisplayName ? `
        <tr style="background-color: #6366f1;">
          <td style="padding: 12px; border: 1px solid #5558e3; color: white;">
            <strong>Selected Plan</strong>
          </td>
          <td style="padding: 12px; border: 1px solid #5558e3; color: white; font-weight: bold; font-size: 16px;">
            ${planDisplayName}
          </td>
        </tr>
    ` : '';

    const notificationHtml = `
      <h1>New Demo Request</h1>
      <table style="border-collapse: collapse; width: 100%;">
        ${selectedPlanRow}
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Name</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.name}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Email</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;"><a href="mailto:${data.email}">${data.email}</a></td>
        </tr>
        ${data.company ? `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Company</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.company}</td>
        </tr>
        ` : ''}
        ${data.subject ? `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Subject</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.subject}</td>
        </tr>
        ` : ''}
        ${data.message ? `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Message</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.message}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Source</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${data.source || 'website'}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;"><strong>Submitted At</strong></td>
          <td style="padding: 8px; border: 1px solid #ddd;">${timestamp}</td>
        </tr>
      </table>
    `;

    console.log("Sending notification email to contact@launchpulse.io with subject:", emailSubject);
    const notificationResult = await resend.emails.send({
      from: "LaunchPulse <noreply@launchpulse.io>",
      to: ["contact@launchpulse.io"],
      subject: emailSubject,
      html: notificationHtml,
    });
    console.log("Notification email sent:", notificationResult);

    const confirmationHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #1a1a2e;">Thanks for your interest in LaunchPulse!</h1>
        <p>Hi ${data.name},</p>
        <p>We've received your demo request and are excited to show you how LaunchPulse can transform your go-to-market strategy.</p>
        <p><strong>What happens next?</strong></p>
        <ul>
          <li>A member of our team will reach out within 24 hours</li>
          <li>We'll schedule a personalized demo based on your needs</li>
          <li>You'll see firsthand how our AI-powered platform can help you identify and close high-value accounts faster</li>
        </ul>
        <p>In the meantime, feel free to explore our <a href="https://launchpulse.io/landing" style="color: #6366f1;">website</a> to learn more about our features.</p>
        <p>Have questions? Reply to this email or reach us at <a href="mailto:contact@launchpulse.io" style="color: #6366f1;">contact@launchpulse.io</a>.</p>
        <p style="margin-top: 32px;">Best,<br>The LaunchPulse Team</p>
      </div>
    `;

    console.log("Sending confirmation email to", data.email);
    const confirmationResult = await resend.emails.send({
      from: "LaunchPulse <noreply@launchpulse.io>",
      to: [data.email],
      subject: "Thanks for your interest in LaunchPulse!",
      html: confirmationHtml,
    });
    console.log("Confirmation email sent:", confirmationResult);

    // Persist lead to marketing_leads table
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

      const { error: insertError } = await supabaseAdmin
        .from("marketing_leads")
        .upsert(
          {
            email: data.email,
            name: data.name,
            company: data.company || null,
            subject: data.subject || null,
            message: data.message || null,
            source: data.source || "demo-contact",
          },
          { onConflict: "email,source" }
        );

      if (insertError) {
        console.error("Failed to insert marketing lead:", insertError);
      } else {
        console.log("Marketing lead saved successfully");
      }
    } catch (dbError) {
      console.error("Database error saving marketing lead:", dbError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Demo request received successfully" 
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error processing demo request:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to process request" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
