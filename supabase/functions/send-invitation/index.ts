import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InvitationRequest {
  email: string;
  inviteUrl: string;
  orgName: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, inviteUrl, orgName }: InvitationRequest = await req.json();

    console.log("Sending invitation to:", email);

    const emailResponse = await resend.emails.send({
      from: "SignalScore <onboarding@resend.dev>", // Change this to your verified domain
      to: [email],
      subject: `You're invited to join ${orgName} on SignalScore`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Invitation to SignalScore</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
            <table role="presentation" style="width: 100%; border-collapse: collapse;">
              <tr>
                <td align="center" style="padding: 40px 0;">
                  <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                    <!-- Header -->
                    <tr>
                      <td style="padding: 40px 40px 20px; text-align: center;">
                        <h1 style="margin: 0; color: #18181b; font-size: 28px; font-weight: 600;">
                          You're invited to SignalScore
                        </h1>
                      </td>
                    </tr>
                    
                    <!-- Body -->
                    <tr>
                      <td style="padding: 20px 40px;">
                        <p style="margin: 0 0 20px; color: #52525b; font-size: 16px; line-height: 24px;">
                          You've been invited to join <strong>${orgName}</strong> on SignalScore, the intelligent account scoring platform.
                        </p>
                        
                        <p style="margin: 0 0 30px; color: #52525b; font-size: 16px; line-height: 24px;">
                          Click the button below to accept the invitation and create your account:
                        </p>
                        
                        <!-- CTA Button -->
                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td align="center" style="padding: 0;">
                              <a href="${inviteUrl}" 
                                 style="display: inline-block; padding: 14px 32px; background-color: #3b82f6; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                                Accept Invitation
                              </a>
                            </td>
                          </tr>
                        </table>
                        
                        <p style="margin: 30px 0 0; color: #71717a; font-size: 14px; line-height: 20px;">
                          Or copy and paste this link into your browser:
                        </p>
                        <p style="margin: 8px 0 0; color: #3b82f6; font-size: 14px; line-height: 20px; word-break: break-all;">
                          ${inviteUrl}
                        </p>
                      </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                      <td style="padding: 30px 40px; border-top: 1px solid #e4e4e7;">
                        <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 18px;">
                          This invitation will expire in 7 days. If you didn't expect this invitation, you can safely ignore this email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </body>
        </html>
      `,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-invitation function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
