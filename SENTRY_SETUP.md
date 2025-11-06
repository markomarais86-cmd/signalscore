# Sentry Integration Setup

Sentry has been integrated into the application for production error tracking and monitoring.

## Configuration Required

To enable Sentry error tracking, you need to add your Sentry DSN (Data Source Name):

### Option 1: Add to .env file (Recommended for Development)

Add the following to your `.env` file:

```env
VITE_SENTRY_DSN=your_sentry_dsn_here
```

### Option 2: Use Supabase Secrets (Recommended for Production)

For production deployments with Supabase, add the secret through the Supabase dashboard or CLI:

```bash
supabase secrets set VITE_SENTRY_DSN=your_sentry_dsn_here
```

## Getting Your Sentry DSN

1. Create a free account at [https://sentry.io](https://sentry.io)
2. Create a new project and select "React" as the platform
3. Copy the DSN from the project settings
4. The DSN looks like: `https://[key]@[organization].ingest.sentry.io/[project-id]`

## Features Enabled

### Error Tracking
- Automatic capture of unhandled errors and promise rejections
- React Error Boundary integration
- Component stack traces

### Performance Monitoring
- 10% of transactions sampled in production
- 100% in development
- Automatic page load performance tracking

### Session Replay
- 10% of sessions recorded
- 100% of sessions with errors recorded
- Sensitive data automatically masked

### User Context
- User ID and email automatically attached to errors
- Cleared on sign out for privacy

## Behavior

- **Development**: Sentry is disabled but logs events to console
- **Production**: Sentry is fully enabled with the above sampling rates
- **Without DSN**: Application works normally, error tracking is disabled with a console warning

## Testing

To test Sentry integration:

1. Add your DSN to `.env`
2. Trigger an error in the application
3. Check your Sentry dashboard for the error report

## Privacy & Data Collection

- All text and media in Session Replays are automatically masked
- User context includes only ID and email (no passwords or sensitive data)
- You can further customize what data is sent in `src/config/sentry.ts`
