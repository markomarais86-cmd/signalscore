import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AuthSystem from "@/components/AuthSystem";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const [autoLogging, setAutoLogging] = useState(true);

  useEffect(() => {
    // Auto-login for preview/development - calls admin-login edge function
    const autoLogin = async () => {
      try {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          setAutoLogging(false);
          return;
        }

        const response = await fetch(
          `https://dhyfbaptcprxxixgnpby.supabase.co/functions/v1/admin-login`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRoeWZiYXB0Y3ByeHhpeGducGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgzNDQ0NzksImV4cCI6MjA2MzkyMDQ3OX0.wadO7aQoaPuXI1ykXJCxjdsk7vGbJ2Jg6q0bWGtmQbM',
            },
            body: JSON.stringify({ email: 'marko.marais86@gmail.com' }),
          }
        );

        const result = await response.json();
        if (result.session) {
          await supabase.auth.setSession({
            access_token: result.session.access_token,
            refresh_token: result.session.refresh_token,
          });
        }
      } catch (err) {
        console.error('Auto-login failed:', err);
      } finally {
        setAutoLogging(false);
      }
    };

    autoLogin();
  }, []);

  if (autoLogging) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">Signing you in...</span>
      </div>
    );
  }

  return <AuthSystem />;
}
