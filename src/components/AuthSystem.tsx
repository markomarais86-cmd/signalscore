import { useState, useEffect, useActionState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Mail, Lock, User, Building, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { FormState, initialFormState, validateEmail, validatePassword, getFormValue, createErrorState, createFormState } from '@/lib/form-actions';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { BrandLogo } from '@/components/BrandLogo';

const PENDING_INVITE_KEY = 'pending_invitation_token';

export function AuthSystem() {
  const { signIn, signUp, resetPassword, user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteTokenFromUrl = searchParams.get('invite');
  
  const [inviteToken, setInviteToken] = useState<string | null>(() => {
    return inviteTokenFromUrl || localStorage.getItem(PENDING_INVITE_KEY);
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [invitationInfo, setInvitationInfo] = useState<any>(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordSent, setForgotPasswordSent] = useState(false);

  // Persist invite token to localStorage when present in URL
  useEffect(() => {
    if (inviteTokenFromUrl) {
      localStorage.setItem(PENDING_INVITE_KEY, inviteTokenFromUrl);
      setInviteToken(inviteTokenFromUrl);
    }
  }, [inviteTokenFromUrl]);

  // Handle auth state changes - accept invitation after email verification
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const pendingToken = localStorage.getItem(PENDING_INVITE_KEY);
        
        if (pendingToken) {
          try {
            const { data: acceptResult, error: acceptError } = await supabase.rpc(
              'accept_invitation',
              { p_token: pendingToken, p_user_id: session.user.id }
            );

            const result = acceptResult as any;
            
            if (acceptError || !result?.success) {
              toast({
                title: 'Invitation Issue',
                description: 'There was an issue with the invitation. Please contact support.',
                variant: 'destructive',
              });
            } else {
              toast({
                title: `Welcome to the team! 🎉`,
                description: 'Your invitation has been accepted.',
              });
              localStorage.setItem('show_onboarding', 'true');
            }
          } catch (err) {
            console.error('Error accepting invitation:', err);
          } finally {
            localStorage.removeItem(PENDING_INVITE_KEY);
          }
        }
        
        navigate('/', { replace: true });
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    const checkAuth = async () => {
      if (loading) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        navigate('/', { replace: true });
      }
    };
    checkAuth();
  }, [loading, navigate]);

  // Load invitation info if token present
  useEffect(() => {
    if (inviteToken) {
      loadInvitationInfo(inviteToken);
    }
  }, [inviteToken]);

  const loadInvitationInfo = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from('invitations')
        .select('*, organizations(name)')
        .eq('token', token)
        .eq('status', 'pending')
        .single();

      if (error || !data) {
        toast({
          title: 'Invalid Invitation',
          description: 'This invitation is invalid or has expired.',
          variant: 'destructive',
        });
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        toast({
          title: 'Invitation Expired',
          description: 'This invitation has expired. Please request a new one.',
          variant: 'destructive',
        });
        return;
      }

      setInvitationInfo(data);
    } catch (error) {
      console.error('Error loading invitation:', error);
    }
  };

  // Sign In Action
  const signInAction = async (prevState: FormState, formData: FormData): Promise<FormState> => {
    const email = getFormValue(formData, 'email');
    const password = getFormValue(formData, 'password');

    if (!validateEmail(email)) {
      return createErrorState('Please enter a valid email address');
    }

    if (!password) {
      return createErrorState('Password is required');
    }

    try {
      toast({ title: "Signing in...", description: "Please wait a moment" });
      
      const { error } = await signIn(email, password);
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          return createErrorState('Invalid email or password. If you recently signed up, please check your email and click the confirmation link first.');
        } else if (error.message.includes('Email not confirmed')) {
          return createErrorState("Please check your email and click the confirmation link before signing in.");
        } else if (error.message.includes('Too many requests')) {
          return createErrorState('Too many sign in attempts. Please wait a few minutes before trying again.');
        }
        return createErrorState(`Sign in failed: ${error.message}`);
      }
      
      toast({ title: "Loading your dashboard...", description: "Almost there!" });
      navigate('/');
      return createFormState();
    } catch (err) {
      return createErrorState('An unexpected error occurred. Please try again.');
    }
  };

  // Sign Up Action
  const signUpAction = async (prevState: FormState, formData: FormData): Promise<FormState> => {
    const email = getFormValue(formData, 'email');
    const password = getFormValue(formData, 'password');
    const confirmPassword = getFormValue(formData, 'confirmPassword');
    const fullName = getFormValue(formData, 'fullName');

    if (!validateEmail(email)) {
      return createErrorState('Please enter a valid email address');
    }

    if (!validatePassword(password)) {
      return createErrorState('Password must be at least 8 characters long');
    }

    if (password !== confirmPassword) {
      return createErrorState('Passwords do not match');
    }

    if (!fullName.trim()) {
      return createErrorState('Full name is required');
    }

    try {
      const redirectUrl = inviteToken 
        ? `${window.location.origin}/auth?invite=${inviteToken}`
        : `${window.location.origin}/auth`;
      
      const { error } = await signUp(email, password, fullName, redirectUrl);

      if (error) {
        if (error.message.includes('User already registered')) {
          return createErrorState('An account with this email already exists. Please sign in instead.');
        }
        return createErrorState(`Sign up failed: ${error.message}`);
      }

      const orgName = invitationInfo?.organizations?.name;
      toast({
        title: "Account created successfully!",
        description: orgName 
          ? `Please check your email and click the confirmation link to join ${orgName}.`
          : "Please check your email inbox and click the confirmation link before signing in.",
      });
      
      return createFormState();
    } catch (err) {
      return createErrorState('An unexpected error occurred. Please try again.');
    }
  };

  const [signInState, signInFormAction, signInPending] = useActionState(signInAction, initialFormState);
  const [signUpState, signUpFormAction, signUpPending] = useActionState(signUpAction, initialFormState);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(forgotPasswordEmail)) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }
    
    setForgotPasswordLoading(true);
    
    const { error } = await resetPassword(forgotPasswordEmail);
    
    setForgotPasswordLoading(false);
    
    if (!error) {
      setForgotPasswordSent(true);
    }
  };

  // Forgot Password View
  if (showForgotPassword) {
    return (
      <GradientBackground variant="auth" showOrbs>
        <main className="min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-fade-in">
            <div className="text-center mb-8">
              <BrandLogo variant="light" className="justify-center" />
            </div>

            <Card variant="glass" className="shadow-glow-sm">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-2xl font-bold">
                  {forgotPasswordSent ? 'Check Your Email' : 'Reset Password'}
                </CardTitle>
                <p className="text-white/60 text-sm mt-1">
                  {forgotPasswordSent 
                    ? "We've sent you a password reset link"
                    : "Enter your email and we'll send you a reset link"
                  }
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                {forgotPasswordSent ? (
                  <div className="space-y-4">
                    <Alert className="bg-primary/10 border-primary/20">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <AlertDescription className="text-foreground">
                        If an account exists for <strong>{forgotPasswordEmail}</strong>, you'll receive an email with a reset link shortly.
                      </AlertDescription>
                    </Alert>
                    <p className="text-sm text-white/60 text-center">
                      Didn't receive the email? Check your spam folder or try again.
                    </p>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="default"
                        className="w-full"
                        onClick={async () => {
                          setForgotPasswordLoading(true);
                          await resetPassword(forgotPasswordEmail);
                          setForgotPasswordLoading(false);
                        }}
                        disabled={forgotPasswordLoading}
                      >
                        {forgotPasswordLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          "Resend link"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                          setForgotPasswordSent(false);
                          setForgotPasswordEmail('');
                        }}
                      >
                        Try another email
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full text-white/50 hover:text-primary"
                        onClick={() => {
                          setShowForgotPassword(false);
                          setForgotPasswordSent(false);
                          setForgotPasswordEmail('');
                        }}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Sign In
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="forgot-email" className="text-sm font-medium">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="forgot-email"
                          name="email"
                          type="email"
                          placeholder="you@company.com"
                          value={forgotPasswordEmail}
                          onChange={(e) => setForgotPasswordEmail(e.target.value)}
                          className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 input-glow"
                          disabled={forgotPasswordLoading}
                        />
                      </div>
                    </div>
                    
                    <Button type="submit" className="w-full" variant="glow" disabled={forgotPasswordLoading}>
                      {forgotPasswordLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send Reset Link'
                      )}
                    </Button>
                    
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-white/50 hover:text-primary"
                      onClick={() => setShowForgotPassword(false)}
                    >
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Sign In
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground variant="auth" showOrbs>
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in">
          {/* Logo */}
          <div className="text-center mb-8">
            <BrandLogo variant="light" className="justify-center" />
          </div>

          <Card variant="glass" className="shadow-glow-sm">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-2xl font-bold">
                {invitationInfo ? 'Accept Invitation' : 'Welcome Back'}
              </CardTitle>
              <p className="text-white/60 text-sm mt-1">
                ICP Analysis & Lead Scoring Platform
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {invitationInfo && (
                <Alert className="mb-4 bg-primary/10 border-primary/20">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-foreground">
                    You've been invited to join <strong>{invitationInfo.organizations?.name}</strong>
                  </AlertDescription>
                </Alert>
              )}
              
              <Tabs defaultValue={inviteToken ? "signup" : "signin"} className="space-y-4">
                <TabsList className="grid w-full grid-cols-2 bg-muted/50">
                  <TabsTrigger value="signin" className="data-[state=active]:bg-background">Sign In</TabsTrigger>
                  <TabsTrigger value="signup" className="data-[state=active]:bg-background">Sign Up</TabsTrigger>
                </TabsList>

                {/* Sign In Form */}
                <TabsContent value="signin">
                  <form action={signInFormAction} className="space-y-4">
                    {signInState.error && (
                      <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                        <AlertDescription>{signInState.error}</AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="signin-email" className="text-sm font-medium">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signin-email"
                          name="email"
                          type="email"
                          placeholder="you@company.com"
                          className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 input-glow"
                          disabled={signInPending}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="signin-password" className="text-sm font-medium">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signin-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          className="pl-10 pr-10 bg-background/50 border-border/50 focus:border-primary/50 input-glow"
                          disabled={signInPending}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button type="submit" className="w-full" variant="glow" disabled={signInPending}>
                      {signInPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        'Sign In'
                      )}
                    </Button>

                    <div className="text-center">
                      <Button
                        type="button"
                        variant="link"
                        className="text-sm text-white/50 hover:text-primary"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Forgot password?
                      </Button>
                    </div>
                  </form>
                </TabsContent>

                {/* Sign Up Form */}
                <TabsContent value="signup">
                  <form action={signUpFormAction} className="space-y-4">
                    {signUpState.error && (
                      <Alert variant="destructive" className="bg-destructive/10 border-destructive/20">
                        <AlertDescription>{signUpState.error}</AlertDescription>
                      </Alert>
                    )}
                    
                    <div className="space-y-2">
                      <Label htmlFor="signup-name" className="text-sm font-medium">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-name"
                          name="fullName"
                          type="text"
                          placeholder="John Doe"
                          className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 input-glow"
                          disabled={signUpPending}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-email"
                          name="email"
                          type="email"
                          placeholder="you@company.com"
                          className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 input-glow"
                          defaultValue={invitationInfo?.email || ''}
                          disabled={signUpPending}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-company" className="text-sm font-medium">Company (Optional)</Label>
                      <div className="relative">
                        <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-company"
                          name="company"
                          type="text"
                          placeholder="Your Company"
                          className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 input-glow"
                          disabled={signUpPending}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-password" className="text-sm font-medium">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-password"
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a password"
                          className="pl-10 pr-10 bg-background/50 border-border/50 focus:border-primary/50 input-glow"
                          disabled={signUpPending}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-white/50">
                        Must be at least 8 characters long
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="signup-confirm" className="text-sm font-medium">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="signup-confirm"
                          name="confirmPassword"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          className="pl-10 bg-background/50 border-border/50 focus:border-primary/50 input-glow"
                          disabled={signUpPending}
                        />
                      </div>
                    </div>

                    <Button type="submit" className="w-full" variant="glow" disabled={signUpPending}>
                      {signUpPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        'Create Account'
                      )}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-6 space-y-4 text-center text-sm text-muted-foreground">
                <div className="glass-card p-4 rounded-xl">
                  <p className="font-medium mb-2 text-foreground">📧 Email Confirmation Required</p>
                  <p className="text-xs">
                    After signing up, check your email and click the confirmation link before signing in.
                  </p>
                </div>
                <p className="text-xs">
                  By signing in, you agree to our{' '}
                  <Link to="/terms" className="text-primary hover:underline">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </GradientBackground>
  );
}

export default AuthSystem;
