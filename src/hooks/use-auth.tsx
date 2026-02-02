import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { authLogger } from '@/lib/logger';

// Helper functions for Sentry (loaded dynamically)
const setUserContextSafe = async (user: { id: string; email?: string }) => {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    try {
      const { setUserContext } = await import('@/config/sentry');
      setUserContext(user);
    } catch (e) {
      console.error('Failed to set Sentry user context:', e);
    }
  }
};

const clearUserContextSafe = async () => {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    try {
      const { clearUserContext } = await import('@/config/sentry');
      clearUserContext();
    } catch (e) {
      console.error('Failed to clear Sentry user context:', e);
    }
  }
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userProfile: UserProfile | null;
  signUp: (email: string, password: string, fullName: string, customRedirectUrl?: string) => Promise<{ error: any }>;
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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let mounted = true;
    let profileFetchInProgress = false;
    
    // Helper function to fetch and cache profile
    const fetchAndCacheProfile = async (userId: string): Promise<void> => {
      if (profileFetchInProgress) return;
      profileFetchInProgress = true;
      
      try {
        const { data: profile, error } = await supabase
          .from('user_profiles')
          .select('org_id, role, full_name, user_id, created_at')
          .eq('user_id', userId)
          .maybeSingle();
          
        if (!mounted) return;
        
        if (error) {
          authLogger.error('Error fetching user profile:', error);
        } else if (profile) {
          authLogger.info('User profile loaded:', profile);
          setUserProfile(profile as UserProfile);
          sessionStorage.setItem('user_profile_cache', JSON.stringify({
            profile,
            timestamp: Date.now()
          }));
          
          if (profile.org_id) {
            const { count } = await supabase
              .from('accounts')
              .select('id', { count: 'exact', head: true })
              .eq('org_id', profile.org_id)
              .limit(1);
            
            if (count === 0) {
              localStorage.setItem('show_onboarding', 'true');
            }
          }
        }
      } finally {
        profileFetchInProgress = false;
      }
    };
    
    // Set up auth state listener for ONGOING changes (after initial load)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        authLogger.info('State change event:', event);
        if (!mounted) return;
        
        // Skip handling during initial load - initializeAuth handles that
        if (!initialLoadComplete && event === 'INITIAL_SESSION') {
          return;
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setUserContextSafe({
            id: session.user.id,
            email: session.user.email,
          });
          
          // Refresh profile in background for ongoing auth changes
          setTimeout(() => {
            fetchAndCacheProfile(session.user.id);
          }, 0);
        } else {
          clearUserContextSafe();
          setUserProfile(null);
          sessionStorage.removeItem('user_profile_cache');
          
          if (event === 'SIGNED_OUT') {
            authLogger.info('User signed out, redirecting to /landing');
            window.location.href = '/landing';
          }
        }
      }
    );

    // Initialize auth - restore session and profile BEFORE setting loading false
    const initializeAuth = async () => {
      try {
        // Check cache first for instant restore
        const cached = sessionStorage.getItem('user_profile_cache');
        if (cached) {
          try {
            const { profile, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 60 * 1000) {
              authLogger.debug('Pre-loading cached profile');
              setUserProfile(profile as UserProfile);
            }
          } catch (e) {
            sessionStorage.removeItem('user_profile_cache');
          }
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        authLogger.debug('Initial session check:', !!session);
        
        if (error) {
          authLogger.error('Error getting session:', error);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch profile BEFORE setting loading false to prevent race
        if (session?.user) {
          setUserContextSafe({
            id: session.user.id,
            email: session.user.email,
          });
          await fetchAndCacheProfile(session.user.id);
        }
      } catch (error) {
        authLogger.error('Fatal error during init:', error);
      } finally {
        if (mounted) {
          setInitialLoadComplete(true);
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [initialLoadComplete]);

  const signUp = async (email: string, password: string, fullName: string, customRedirectUrl?: string) => {
    const redirectUrl = customRedirectUrl || `${window.location.origin}/`;
    
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
      authLogger.error('Sign in error:', error);
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
    try {
      authLogger.info('Starting sign out process');
      
      // Clear state immediately
      setUser(null);
      setSession(null);
      setUserProfile(null);
      // Don't set loading to true - let the auth state change handle it
      
      // Sign out from Supabase
      await supabase.auth.signOut();
      
      toast({
        title: "Signed out",
        description: "You have been signed out successfully."
      });
      
      authLogger.info('Sign out complete');
      // The auth state listener will handle the redirect
    } catch (error) {
      authLogger.error('Sign out error:', error);
      toast({
        title: "Error signing out",
        description: "Please try again.",
        variant: "destructive"
      });
    }
  };

  const resetPassword = async (email: string) => {
    // Always use production URL for password reset emails
    // This ensures the email link works regardless of where the reset was triggered
    const productionUrl = 'https://www.launchpulse.io';
    const redirectUrl = `${productionUrl}/reset-password`;
    
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