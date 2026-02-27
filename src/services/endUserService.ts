import { supabase } from "@/integrations/supabase/client";

export interface ConsoleUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string | null;
}

export interface UserNote {
  id: string;
  target_user_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author_name?: string;
  author_email?: string;
}

export const fetchConsoleUsers = async (searchQuery: string = ""): Promise<ConsoleUser[]> => {
  const { data, error } = await (supabase.rpc as any)("get_console_users", {
    search_query: searchQuery,
  });
  if (error) throw error;
  return (data ?? []) as ConsoleUser[];
};

export const fetchConsoleUserDetail = async (userId: string): Promise<ConsoleUser | null> => {
  const { data, error } = await supabase.rpc("get_console_user_detail", {
    target_id: userId,
  });
  if (error) throw error;
  const rows = data as ConsoleUser[];
  return rows?.[0] ?? null;
};

export const fetchUserNotes = async (targetUserId: string): Promise<UserNote[]> => {
  const { data, error } = await supabase
    .from("user_notes")
    .select("*")
    .eq("target_user_id", targetUserId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Fetch author profiles for display
  const authorIds = [...new Set((data ?? []).map((n: any) => n.author_id))];

  // Fetch staff profiles for note authors
  const { data: staffProfiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .in("id", authorIds);

  const authorMap = new Map<string, { name: string; email: string }>();
  (staffProfiles ?? []).forEach((p: any) => {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || "Staff";
    authorMap.set(p.id, { name, email: p.email ?? "" });
  });

  return (data ?? []).map((n: any) => ({
    ...n,
    author_name: authorMap.get(n.author_id)?.name ?? "Utente",
    author_email: authorMap.get(n.author_id)?.email ?? "",
  }));
};

export const addUserNote = async (targetUserId: string, authorId: string, content: string) => {
  const { error } = await supabase.from("user_notes").insert({
    target_user_id: targetUserId,
    author_id: authorId,
    content,
  });
  if (error) throw error;
};

export const fetchUserWallets = async (userId: string) => {
  const { data, error } = await supabase
    .from("structure_wallets")
    .select("*, structures:structure_id(id, name)")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
};

export const updateWalletBalance = async (walletId: string, newBalance: number) => {
  const { error } = await supabase
    .from("structure_wallets")
    .update({ balance: newBalance })
    .eq("id", walletId);
  if (error) throw error;
};
