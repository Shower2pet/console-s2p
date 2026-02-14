import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export type AppRole = "admin" | "partner" | "manager" | "user";

export interface Profile {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: AppRole | null;
  stripe_customer_id: string | null;
  must_change_password: boolean | null;
  legal_name: string | null;
  vat_number: string | null;
  fiscal_code: string | null;
  acube_company_id: string | null;
}

/** IDs of structures the current user can manage (partner = owned, manager = assigned) */
export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: AppRole | null;
  loading: boolean;
  /** structure IDs the user has access to */
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
    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData as Profile);
    }

    // Determine structure access based on role
    const role = profileData?.role as AppRole | null;

    if (role === "admin") {
      // Admin sees everything – no need to filter
      setStructureIds([]);
    } else if (role === "partner") {
      const { data: owned } = await supabase
        .from("structures")
        .select("id")
        .eq("owner_id", userId);
      setStructureIds((owned ?? []).map((s) => s.id));
    } else if (role === "manager") {
      const { data: managed } = await supabase
        .from("structure_managers")
        .select("structure_id")
        .eq("user_id", userId);
      setStructureIds(
        (managed ?? []).filter((m) => m.structure_id).map((m) => m.structure_id as string)
      );
    } else {
      setStructureIds([]);
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Defer profile fetch to avoid Supabase deadlocks
          setTimeout(() => fetchProfile(newSession.user.id), 0);
        } else {
          setProfile(null);
          setStructureIds([]);
        }
        setLoading(false);
      }
    );

    // THEN check existing session
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
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
