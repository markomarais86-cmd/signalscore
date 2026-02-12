import React from 'npm:react@18.3.1'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { Resend } from 'npm:resend@4.0.0'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { PasswordResetEmail } from './_templates/password-reset.tsx'

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string)

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

  // Get and validate the hook secret inside the handler
  const rawHookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  if (!rawHookSecret) {
    console.error('SEND_EMAIL_HOOK_SECRET is not set')
    return new Response(
      JSON.stringify({ error: { http_code: 500, message: 'Missing hook secret configuration' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Supabase hook secrets can be in format: "v1,whsec_<base64>" or "whsec_<base64>" or raw base64
  // The standardwebhooks library expects just the raw base64 part
  let hookSecret = rawHookSecret
  if (hookSecret.includes('whsec_')) {
    // Extract everything after 'whsec_'
    hookSecret = hookSecret.split('whsec_').pop() || hookSecret
  }

  console.log(`Hook secret length: ${hookSecret.length}, starts with: ${hookSecret.substring(0, 4)}...`)

  const payload = await req.text()
  const headers = Object.fromEntries(req.headers)

  // Verify webhook signature
  let wh: InstanceType<typeof Webhook>
  try {
    wh = new Webhook(hookSecret)
  } catch (error) {
    console.error('Failed to initialize Webhook with secret:', error.message)
    // Try with the raw secret (without stripping prefix) as fallback
    try {
      wh = new Webhook(rawHookSecret)
      console.log('Webhook initialized with raw secret (including prefix)')
    } catch (error2) {
      console.error('Failed with raw secret too:', error2.message)
      return new Response(
        JSON.stringify({ error: { http_code: 500, message: 'Invalid hook secret format' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  let data: AuthEmailPayload

  try {
    data = wh!.verify(payload, headers) as AuthEmailPayload
    console.log('Webhook verified successfully')
  } catch (error) {
    console.error('Webhook verification failed:', error)
    return new Response(
      JSON.stringify({ error: { http_code: 401, message: 'Webhook verification failed' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const { user, email_data } = data
  const { token_hash, redirect_to, email_action_type } = email_data

  console.log(`Processing ${email_action_type} email for ${user.email}`)

  // Only handle password reset (recovery) emails for now
  if (email_action_type !== 'recovery') {
    console.log(`Skipping email type: ${email_action_type} (not yet implemented)`)
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const resetUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${redirect_to}`

    const html = await renderAsync(
      React.createElement(PasswordResetEmail, {
        resetUrl,
        userEmail: user.email,
      })
    )

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
      JSON.stringify({ error: { http_code: 500, message: error.message || 'Failed to send email' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
