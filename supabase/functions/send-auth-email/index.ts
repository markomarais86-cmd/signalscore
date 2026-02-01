import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { PasswordResetEmail } from './_templates/password-reset.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)
const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET') as string

interface AuthEmailPayload {
  user: {
    id: string
    email: string
    user_metadata?: {
      full_name?: string
      name?: string
    }
  }
  email_data: {
    token: string
    token_hash: string
    redirect_to: string
    email_action_type: string
    site_url: string
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  // Verify webhook signature
  const wh = new Webhook(hookSecret)
  let data: AuthEmailPayload

  try {
    data = wh.verify(payload, headers) as AuthEmailPayload
    console.log('Webhook verified successfully')
  } catch (error) {
    console.error('Webhook verification failed:', error)
    return new Response(
      JSON.stringify({
        error: {
          http_code: 401,
          message: 'Webhook verification failed',
        },
      }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const { user, email_data } = data
  const { token_hash, redirect_to, email_action_type } = email_data

  console.log(`Processing ${email_action_type} email for ${user.email}`)

  // Only handle password reset (recovery) emails for now
  if (email_action_type !== 'recovery') {
    console.log(`Skipping email type: ${email_action_type} (not yet implemented)`)
    // Return success but don't send - let Supabase send the default
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    // Construct the reset URL
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const resetUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

    // Render the email template
    const html = await renderAsync(
      React.createElement(PasswordResetEmail, {
        resetUrl,
        userEmail: user.email,
      })
    )

    // Send via Resend
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: 'LaunchPulse <noreply@launchpulse.io>',
      to: [user.email],
      subject: 'Reset Your Password - LaunchPulse',
      html,
    })

    if (emailError) {
      console.error('Resend error:', emailError)
      throw emailError
    }

    console.log('Password reset email sent successfully:', emailResult)

    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error sending password reset email:', error)
    return new Response(
      JSON.stringify({
        error: {
          http_code: 500,
          message: error.message || 'Failed to send email',
        },
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
})
