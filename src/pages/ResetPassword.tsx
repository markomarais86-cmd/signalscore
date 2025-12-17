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
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>Enter your new password</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-4">
            {state.error && (
              <p className="text-sm text-destructive">{state.error}</p>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                disabled={isPending}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isPending}>
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
  );
}
