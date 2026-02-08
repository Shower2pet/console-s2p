import { createContext, useContext, useState, ReactNode } from "react";

export type AppRole = "ADMIN" | "CLIENT";

export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  clientId?: string; // links CLIENT users to a client record
}

const MOCK_USERS: MockUser[] = [
  { id: "u1", email: "admin@test.com", name: "Admin S2P", role: "ADMIN" },
  { id: "u2", email: "client@test.com", name: "PetShop Roma", role: "CLIENT", clientId: "1" },
];

interface AuthContextValue {
  user: MockUser | null;
  login: (email: string, password: string) => { success: boolean; error?: string };
  logout: () => void;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<MockUser | null>(() => {
    const saved = localStorage.getItem("s2p_user");
    if (saved) {
      try { return JSON.parse(saved); } catch { return null; }
    }
    return null;
  });

  const login = (email: string, _password: string) => {
    const found = MOCK_USERS.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!found) return { success: false, error: "Credenziali non valide" };
    setUser(found);
    localStorage.setItem("s2p_user", JSON.stringify(found));
    return { success: true };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("s2p_user");
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isAdmin: user?.role === "ADMIN" }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
