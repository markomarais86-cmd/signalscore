import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface PasswordResetEmailProps {
  resetUrl: string
  userEmail: string
}

export const PasswordResetEmail = ({
  resetUrl,
  userEmail,
}: PasswordResetEmailProps) => {
  const previewText = 'Reset your LaunchPulse password'

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={logoSection}>
            <Img
              src="https://dhyfbaptcprxxixgnpby.supabase.co/storage/v1/object/public/email-assets/launchpulse-logo.png?v=1"
              width="180"
              height="40"
              alt="LaunchPulse"
              style={logo}
            />
          </Section>

          {/* Main Content */}
          <Section style={contentSection}>
            <Heading style={heading}>Reset Your Password</Heading>
            
            <Text style={paragraph}>Hi there,</Text>
            
            <Text style={paragraph}>
              We received a request to reset the password for your LaunchPulse account
              associated with <strong>{userEmail}</strong>.
            </Text>
            
            <Text style={paragraph}>
              Click the button below to create a new password:
            </Text>

            <Section style={buttonContainer}>
              <Button style={button} href={resetUrl}>
                Reset Password
              </Button>
            </Section>

            <Text style={expiryText}>
              This link expires in 1 hour for security reasons.
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Security Notice */}
          <Section style={securitySection}>
            <Heading as="h3" style={securityHeading}>
              🔒 Security Notice
            </Heading>
            <Text style={securityText}>
              If you didn't request this password reset, you can safely ignore this email. 
              Your password will remain unchanged and your account is secure.
            </Text>
          </Section>

          <Hr style={hr} />

          {/* Help Section */}
          <Section style={helpSection}>
            <Text style={helpText}>
              <strong>Having trouble with the button?</strong>
            </Text>
            <Text style={helpText}>
              Copy and paste this link into your browser:
            </Text>
            <Link href={resetUrl} style={linkText}>
              {resetUrl}
            </Link>
            <Text style={helpText}>
              Need help? Contact us at{' '}
              <Link href="mailto:support@launchpulse.io" style={supportLink}>
                support@launchpulse.io
              </Link>
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              © {new Date().getFullYear()} LaunchPulse. All rights reserved.
            </Text>
            <Text style={tagline}>
              Where GTM Meets ICP Precision
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default PasswordResetEmail

// Styles
const main = {
  backgroundColor: '#f4f4f5',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '0',
  maxWidth: '600px',
  borderRadius: '8px',
  overflow: 'hidden',
}

const logoSection = {
  backgroundColor: '#18181b',
  padding: '24px 40px',
  textAlign: 'center' as const,
}

const logo = {
  margin: '0 auto',
}

const contentSection = {
  padding: '40px',
}

const heading = {
  color: '#18181b',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 24px 0',
  textAlign: 'center' as const,
}

const paragraph = {
  color: '#3f3f46',
  fontSize: '16px',
  lineHeight: '1.6',
  margin: '0 0 16px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
}

const button = {
  backgroundColor: '#6366f1',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '14px 32px',
}

const expiryText = {
  color: '#71717a',
  fontSize: '14px',
  textAlign: 'center' as const,
  margin: '0',
}

const hr = {
  borderColor: '#e4e4e7',
  margin: '0',
}

const securitySection = {
  padding: '24px 40px',
  backgroundColor: '#fafafa',
}

const securityHeading = {
  color: '#18181b',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 12px 0',
}

const securityText = {
  color: '#52525b',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0',
}

const helpSection = {
  padding: '24px 40px',
}

const helpText = {
  color: '#71717a',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 8px 0',
}

const linkText = {
  color: '#6366f1',
  fontSize: '12px',
  wordBreak: 'break-all' as const,
  display: 'block',
  margin: '8px 0 16px 0',
}

const supportLink = {
  color: '#6366f1',
  textDecoration: 'underline',
}

const footer = {
  backgroundColor: '#f4f4f5',
  padding: '24px 40px',
  textAlign: 'center' as const,
}

const footerText = {
  color: '#71717a',
  fontSize: '12px',
  margin: '0 0 4px 0',
}

const tagline = {
  color: '#a1a1aa',
  fontSize: '11px',
  fontStyle: 'italic',
  margin: '0',
}
