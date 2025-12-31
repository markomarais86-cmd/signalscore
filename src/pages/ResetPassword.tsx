import { useActionState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
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

  useEffect(() => {
    const handleAuthCallback = async () => {
      const { error } = await supabase.auth.getSession();
      if (error) {
        toast({
          title: "Invalid reset link",
          description: "This password reset link is invalid or has expired.",
          variant: "destructive"
        });
        navigate("/auth");
      }
    };
    handleAuthCallback();
  }, [navigate, toast]);

  if (user) {
    return <Navigate to="/" replace />;
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
