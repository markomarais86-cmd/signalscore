import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, EyeOff, Mail, Lock, User, Building, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export function AuthSystem() {
  const { signIn, signUp, user, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite');
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [invitationInfo, setInvitationInfo] = useState<any>(null);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

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

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        toast({
          title: 'Invitation Expired',
          description: 'This invitation has expired. Please request a new one.',
          variant: 'destructive',
        });
        return;
      }

      setInvitationInfo(data);
      setSignUpData((prev) => ({ ...prev, email: data.email }));
    } catch (error) {
      console.error('Error loading invitation:', error);
    }
  };

  // Sign In Form
  const [signInData, setSignInData] = useState({
    email: '',
    password: ''
  });

  // Sign Up Form
  const [signUpData, setSignUpData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    company: ''
  });

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!validateEmail(signInData.email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    if (!signInData.password) {
      setError('Password is required');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await signIn(signInData.email, signInData.password);
      
      if (error) {
        // Provide more specific and helpful error messages
        if (error.message.includes('Invalid login credentials')) {
          setError('Invalid email or password. If you recently signed up, please check your email and click the confirmation link first. You can also try resetting your password.');
        } else if (error.message.includes('Email not confirmed')) {
          setError('Please check your email and click the confirmation link before signing in. Check your spam folder if you don\'t see the email.');
        } else if (error.message.includes('Too many requests')) {
          setError('Too many sign in attempts. Please wait a few minutes before trying again.');
        } else if (error.message.includes('Signup is disabled')) {
          setError('This account may not be properly set up. Please contact support.');
        } else {
          setError(`Sign in failed: ${error.message}`);
        }
      } else {
        toast({
          title: "Welcome back!",
          description: "You've been signed in successfully."
        });
        // Redirect to dashboard after successful sign-in
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError('An unexpected error occurred. Please try again or contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    // Validation
    if (!validateEmail(signUpData.email)) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }

    if (!validatePassword(signUpData.password)) {
      setError('Password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    if (signUpData.password !== signUpData.confirmPassword) {
      setError('Passwords do not match');
      setIsLoading(false);
      return;
    }

    if (!signUpData.fullName.trim()) {
      setError('Full name is required');
      setIsLoading(false);
      return;
    }

    try {
      const { error } = await signUp(
        signUpData.email, 
        signUpData.password,
        signUpData.fullName
      );

      if (error) {
        // Handle specific error cases
        if (error.message.includes('User already registered')) {
          setError('An account with this email already exists. Please sign in instead or try resetting your password.');
        } else if (error.message.includes('signup_disabled')) {
          setError('New account registration is currently disabled.');
        } else if (error.message.includes('Password should be at least 6 characters')) {
          setError('Password must be at least 6 characters long');
        } else if (error.message.includes('Invalid email')) {
          setError('Please enter a valid email address');
        } else {
          setError(`Sign up failed: ${error.message}`);
        }
      } else {
        // If signing up with invitation, accept it
        if (inviteToken && user) {
          const { data: acceptResult, error: acceptError } = await supabase.rpc(
            'accept_invitation',
            { p_token: inviteToken, p_user_id: user.id }
          );

          const result = acceptResult as any;
          
          if (acceptError || !result?.success) {
            console.error('Error accepting invitation:', acceptError);
            toast({
              title: 'Account created',
              description: 'Account created but there was an issue with the invitation. Please contact support.',
              variant: 'default',
            });
          } else {
            toast({
              title: 'Welcome to the team!',
              description: 'Your account has been created and you\'ve joined the organization.',
            });
          }
        } else {
          // Success - show clear instructions
          toast({
            title: "Account created successfully!",
            description: "Please check your email inbox and click the confirmation link before signing in. Check your spam folder if you don't see it.",
          });
        }
        
        // Reset form and switch to sign in tab
        setSignUpData({
          email: '',
          password: '',
          confirmPassword: '',
          fullName: '',
          company: ''
        });
        
        // Auto-switch to sign-in tab after 2 seconds if no invitation
        if (!inviteToken) {
          setTimeout(() => {
            const signInTab = document.querySelector('[value="signin"]') as HTMLButtonElement;
            if (signInTab) signInTab.click();
          }, 2000);
        } else {
          // Redirect to dashboard if accepting invitation
          navigate('/');
        }
      }
    } catch (err) {
      console.error('Sign up error:', err);
      setError('An unexpected error occurred. Please try again or contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">SignalScore</CardTitle>
          <p className="text-muted-foreground">
            ICP Analysis & Lead Scoring Platform
          </p>
        </CardHeader>
        <CardContent>
          {invitationInfo && (
            <Alert className="mb-4">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                You've been invited to join <strong>{invitationInfo.organizations?.name}</strong>
              </AlertDescription>
            </Alert>
          )}
          
          <Tabs defaultValue={inviteToken ? "signup" : "signin"} className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Sign In Form */}
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@company.com"
                      className="pl-10"
                      value={signInData.email}
                      onChange={(e) => setSignInData(prev => ({ ...prev, email: e.target.value }))}
                      disabled={isLoading}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signin-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className="pl-10 pr-10"
                      value={signInData.password}
                      onChange={(e) => setSignInData(prev => ({ ...prev, password: e.target.value }))}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* Sign Up Form */}
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      className="pl-10"
                      value={signUpData.fullName}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, fullName: e.target.value }))}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@company.com"
                      className="pl-10"
                      value={signUpData.email}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, email: e.target.value }))}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-company">Company (Optional)</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-company"
                      type="text"
                      placeholder="Your Company"
                      className="pl-10"
                      value={signUpData.company}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, company: e.target.value }))}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create a password"
                      className="pl-10 pr-10"
                      value={signUpData.password}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, password: e.target.value }))}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be at least 8 characters long
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirm Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-confirm"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      className="pl-10"
                      value={signUpData.confirmPassword}
                      onChange={(e) => setSignUpData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      disabled={isLoading}
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
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
            <div className="bg-muted/50 p-4 rounded-lg">
              <p className="font-medium mb-2">📧 Important: Email Confirmation Required</p>
              <p>
                After signing up, you <strong>must</strong> check your email and click the confirmation link before you can sign in. 
                Check your spam folder if you don't see the email within a few minutes.
              </p>
            </div>
            <p>By signing in, you agree to our Terms of Service and Privacy Policy.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AuthSystem;