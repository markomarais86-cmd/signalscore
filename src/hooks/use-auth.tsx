import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
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
  
  // Phase A: Removed loadingRef - no longer needed without safety timeout

  useEffect(() => {
    let mounted = true;
    let profileFetchInProgress = false;
    
    // Helper function to fetch and cache profile
    const fetchAndCacheProfile = async (userId: string) => {
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
          console.error('Auth: Error fetching user profile:', error);
        } else if (profile) {
          console.log('Auth: User profile loaded:', profile);
          setUserProfile(profile as UserProfile);
          // Cache the profile with 60 second expiry for instant login
          localStorage.setItem('user_profile_cache', JSON.stringify({
            profile,
            timestamp: Date.now()
          }));
        }
      } finally {
        profileFetchInProgress = false;
      }
    };
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth: State change event:', event);
        if (!mounted) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Phase A & B: Use cached profile for INSTANT render
          const cached = localStorage.getItem('user_profile_cache');
          let usedCache = false;
          
          if (cached) {
            try {
              const { profile, timestamp } = JSON.parse(cached);
              // Use cache if less than 60 seconds old for instant login
              if (Date.now() - timestamp < 60 * 1000) {
                console.log('Auth: Using cached profile for instant render');
                setUserProfile(profile as UserProfile);
                setLoading(false);
                usedCache = true;
              }
            } catch (e) {
              localStorage.removeItem('user_profile_cache');
            }
          }
          
          // Always fetch fresh profile in background to keep cache updated
          // But don't block the UI if we have a recent cache
          setTimeout(() => {
            fetchAndCacheProfile(session.user.id);
          }, 0);
          
          // Only wait for profile if no cache was used
          if (!usedCache) {
            setLoading(false);
          }
        } else {
          setUserProfile(null);
          localStorage.removeItem('user_profile_cache');
          setLoading(false);
          
          // Redirect to auth page when signed out
          if (event === 'SIGNED_OUT') {
            console.log('Auth: User signed out, redirecting to /auth');
            window.location.href = '/auth';
          }
        }
      }
    );

    // Check for existing session - Phase C: Remove duplicate profile fetch
    const initAuth = async () => {
      try {
        // Check cache first for instant restore
        const cached = localStorage.getItem('user_profile_cache');
        if (cached) {
          try {
            const { profile, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 60 * 1000) {
              console.log('Auth: Pre-loading cached profile');
              setUserProfile(profile as UserProfile);
            }
          } catch (e) {
            localStorage.removeItem('user_profile_cache');
          }
        }
        
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        console.log('Auth: Initial session check:', !!session);
        
        if (error) {
          console.error('Auth: Error getting session:', error);
        }
        
        setSession(session);
        setUser(session?.user ?? null);
        
        // Profile fetch will be handled by onAuthStateChange
        // This eliminates the duplicate fetch
        
        setLoading(false);
      } catch (error) {
        console.error('Auth: Fatal error during init:', error);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initAuth();
    
    // Phase A: Safety timeout removed - trust Supabase auth state listener

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
    try {
      console.log('Auth: Starting sign out process');
      
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
      
      console.log('Auth: Sign out complete, redirecting to /auth');
      // The auth state listener will handle the redirect
    } catch (error) {
      console.error('Sign out error:', error);
      toast({
        title: "Error signing out",
        description: "Please try again.",
        variant: "destructive"
      });
    }
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