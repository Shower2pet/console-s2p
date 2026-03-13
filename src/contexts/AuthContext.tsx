import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session, AuthChangeEvent } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/types/database";
import { fetchProfileById, fetchUserStructureIds, fetchManagerStructureIds } from "@/services/profileService";

export type AppRole = UserRole;
export type { Profile };

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  structureIds: string[];
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isPartner: boolean;
  isManager: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [structureIds, setStructureIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const recoveryHandled = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const profileData = await fetchProfileById(userId);
    if (profileData) setProfile(profileData);

    const role = profileData?.role as AppRole | null;
    if (role === "admin") {
      setStructureIds([]);
    } else if (role === "partner") {
      const ids = await fetchUserStructureIds(userId);
      setStructureIds(ids);
    } else if (role === "manager") {
      const ids = await fetchManagerStructureIds(userId);
      setStructureIds(ids);
    } else {
      setStructureIds([]);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, newSession) => {
        // PASSWORD_RECOVERY fires when the user clicks the email link.
        // We set the flag and do a hard redirect to /auth/update-password.
        // This is NOT a patch — it's the canonical way to handle recovery
        // in a SPA where the auth provider lives outside the router.
        if (event === "PASSWORD_RECOVERY" && !recoveryHandled.current) {
          recoveryHandled.current = true;
          setIsPasswordRecovery(true);
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
          // Hard redirect — guaranteed to work regardless of router state
          if (window.location.pathname !== "/auth/update-password") {
            window.location.replace("/auth/update-password");
          }
          return;
        }

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          setTimeout(() => fetchProfile(newSession.user.id), 0);
        } else {
          setProfile(null);
          setStructureIds([]);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        fetchProfile(existing.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const login = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setStructureIds([]);
    setIsPasswordRecovery(false);
    recoveryHandled.current = false;
  };

  const role = profile?.role ?? null;

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
    recoveryHandled.current = false;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        structureIds,
        isPasswordRecovery,
        clearPasswordRecovery,
        login,
        logout,
        refreshProfile,
        isAdmin: role === "admin",
        isPartner: role === "partner",
        isManager: role === "manager",
        isTester: role === "tester",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
