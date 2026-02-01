import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: DemoRequest = await req.json();
    console.log("Received demo request:", data);

    // Validate required fields
    if (!data.name || !data.email) {
      return new Response(
        JSON.stringify({ error: "Name and email are required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const timestamp = new Date().toISOString();

    // Send notification email to contact@launchpulse.io
    const notificationHtml = `
      <h1>New Demo Request</h1>
      <table style="border-collapse: collapse; width: 100%;">
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

    console.log("Sending notification email to contact@launchpulse.io");
    const notificationResult = await resend.emails.send({
      from: "LaunchPulse <noreply@launchpulse.io>",
      to: ["contact@launchpulse.io"],
      subject: `New Demo Request from ${data.name}`,
      html: notificationHtml,
    });
    console.log("Notification email sent:", notificationResult);

    // Send confirmation email to the requester
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
