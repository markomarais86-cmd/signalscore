import { useActionState, useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FormState, initialFormState, createErrorState, createFormState, getFormValue } from "@/lib/form-actions";
import { GradientBackground } from "@/components/ui/GradientBackground";
import { BrandLogo } from "@/components/BrandLogo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function ResetPassword() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [noSession, setNoSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let mounted = true;
    
    // Check if URL has recovery token (from email link)
    const hasRecoveryToken = window.location.hash.includes('type=recovery') ||
                              window.location.hash.includes('access_token');
    
    // Set up auth state listener FIRST - this catches the PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        
        console.log('Auth event:', event);
        
        if (event === 'PASSWORD_RECOVERY') {
          // Token was valid - session is now active
          setCheckingSession(false);
          setNoSession(false);
        } else if (event === 'SIGNED_IN' && session) {
          // Already signed in
          setCheckingSession(false);
          setNoSession(false);
        }
      }
    );
    
    // Then check for existing session
    const checkSession = async () => {
      // If URL has recovery token, wait a bit for Supabase to process it
      if (hasRecoveryToken) {
        // Give Supabase time to process the hash token
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!mounted) return;
      
      if (session) {
        // Session exists (either from recovery or existing login)
        setNoSession(false);
      } else if (!hasRecoveryToken) {
        // No session AND no recovery token - user navigated directly
        setNoSession(true);
      }
      // If hasRecoveryToken but no session yet, keep waiting for auth event
      
      setCheckingSession(false);
    };
    
    checkSession();
    
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (user) {
    return <Navigate to="/" replace />;
  }

  // Show loading while checking session
  if (checkingSession) {
    return (
      <GradientBackground variant="auth" showOrbs={true}>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </GradientBackground>
    );
  }

  // Show helpful message if user navigated here directly
  if (noSession) {
    return (
      <GradientBackground variant="auth" showOrbs={true}>
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card variant="glass" className="w-full max-w-md border-border/30">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center mb-2">
                <BrandLogo variant="light" />
              </div>
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="text-2xl font-bold text-foreground">Check Your Email</CardTitle>
              <CardDescription className="text-muted-foreground">
                To reset your password, you need to click the link we sent to your email.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="bg-muted/50 border-border/30">
                <AlertDescription className="text-sm text-muted-foreground">
                  <strong>Didn't receive an email?</strong>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>Check your spam or junk folder</li>
                    <li>Make sure you entered the correct email</li>
                    <li>Go back and request a new reset link</li>
                  </ul>
                </AlertDescription>
              </Alert>
              
              <Button
                variant="glow"
                className="w-full"
                onClick={() => navigate('/auth')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Sign In
              </Button>
            </CardContent>
          </Card>
        </div>
      </GradientBackground>
    );
  }

  const resetAction = async (prevState: FormState, formData: FormData): Promise<FormState> => {
    const password = getFormValue(formData, 'password');
    const confirmPassword = getFormValue(formData, 'confirmPassword');

    if (password !== confirmPassword) {
      return createErrorState("Passwords don't match. Please make sure both passwords are the same.");
    }

    if (password.length < 6) {
      return createErrorState("Password must be at least 6 characters long.");
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return createErrorState(error.message);
    }

    toast({
      title: "Password updated",
      description: "Your password has been updated successfully."
    });
    navigate("/");
    return createFormState();
  };

  const [state, formAction, isPending] = useActionState(resetAction, initialFormState);

  return (
    <GradientBackground variant="auth" showOrbs={true}>
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card variant="glass" className="w-full max-w-md border-border/30">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center mb-2">
              <BrandLogo variant="light" />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground">Reset Password</CardTitle>
            <CardDescription className="text-muted-foreground">Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="space-y-4">
              {state.error && (
                <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{state.error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-foreground">New Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  disabled={isPending}
                  className="input-glow bg-background/50 border-border/50 focus:border-primary/50"
                  placeholder="••••••••"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-foreground">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={6}
                  disabled={isPending}
                  className="input-glow bg-background/50 border-border/50 focus:border-primary/50"
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" variant="glow" className="w-full" disabled={isPending}>
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating password...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </GradientBackground>
  );
}
