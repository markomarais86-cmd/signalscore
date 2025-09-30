import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  loading: boolean;
}

interface UserProfile {
  user_id: string;
  org_id: string;
  full_name: string | null;
  role: 'admin' | 'user';
  created_at: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth: State change event:', event);
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false); // Set loading false immediately when auth state changes
        
        if (session?.user) {
          // Fetch user profile in background (don't block)
          console.log('Auth: Fetching profile for user:', session.user.id);
          supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', session.user.id)
            .maybeSingle()
            .then(({ data: profile, error }) => {
              if (!mounted) return;
              
              if (error) {
                console.error('Auth: Error fetching user profile:', error);
              } else if (profile) {
                console.log('Auth: Profile loaded successfully for org:', profile.org_id);
                setUserProfile(profile as UserProfile);
              } else {
                console.warn('Auth: No profile found for user');
              }
            });
        } else {
          setUserProfile(null);
        }
      }
    );

    // Check for existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      
      console.log('Auth: Initial session check:', !!session);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        console.log('Auth: Fetching initial profile for user:', session.user.id);
        supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle()
          .then(({ data: profile, error }) => {
            if (!mounted) return;
            
            if (error) {
              console.error('Auth: Error fetching initial profile:', error);
            } else if (profile) {
              console.log('Auth: Initial profile loaded for org:', profile.org_id);
              setUserProfile(profile as UserProfile);
            }
          });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a confirmation link."
      });
    }

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      console.error('Sign in error:', error);
      let errorMessage = error.message;
      
      // Provide more helpful error messages
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = 'Invalid email or password. Try resetting your password if you recently changed it.';
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = 'Please check your email and click the confirmation link before signing in.';
      }
      
      toast({
        title: "Sign in failed",
        description: errorMessage,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Welcome back!",
        description: "You have been signed in successfully."
      });
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully."
    });
  };

  const resetPassword = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });

    if (error) {
      toast({
        title: "Password reset failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Check your email",
        description: "We've sent you a password reset link."
      });
    }

    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      userProfile,
      signUp,
      signIn,
      signOut,
      resetPassword,
      loading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}