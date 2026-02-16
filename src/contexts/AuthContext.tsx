import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import type { Profile, UserRole } from "@/types/database";
import { fetchProfileById, fetchUserStructureIds, fetchManagerStructureIds } from "@/services/profileService";
import { onAuthStateChange, getSession } from "@/services/authService";
import * as authService from "@/services/authService";

export type AppRole = UserRole;
export type { Profile };

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  structureIds: string[];
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

  const fetchProfile = useCallback(async (userId: string) => {
    const profileData = await fetchProfileById(userId);

    if (profileData) {
      setProfile(profileData);
    }

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
    const { data: { subscription } } = onAuthStateChange(
      async (_event, newSession) => {
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

    getSession().then((existing) => {
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
      await authService.signIn(email, password);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  };

  const logout = async () => {
    await authService.signOut();
    setProfile(null);
    setStructureIds([]);
  };

  const role = profile?.role ?? null;

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        role,
        loading,
        structureIds,
        login,
        logout,
        refreshProfile,
        isAdmin: role === "admin",
        isPartner: role === "partner",
        isManager: role === "manager",
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
