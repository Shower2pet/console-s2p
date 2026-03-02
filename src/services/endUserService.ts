import { supabase } from "@/integrations/supabase/client";

export interface ConsoleUser {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string | null;
  is_guest: boolean;
  total_washes: number;
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

  // Fetch author profiles using security definer function (bypasses RLS)
  const authorIds = [...new Set((data ?? []).map((n: any) => n.author_id))];

  const { data: staffProfiles } = await (supabase.rpc as any)("get_note_authors", {
    author_ids: authorIds,
  });

  const authorMap = new Map<string, { name: string; email: string }>();
  (staffProfiles ?? []).forEach((p: any) => {
    const name = [p.first_name, p.last_name].filter(Boolean).join(" ") || p.role || "Staff";
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

export const deleteEndUser = async (userId: string, isGuest: boolean) => {
  if (isGuest) {
    // Guest users don't have auth accounts — just clean up wash sessions by guest_email
    // We need the email to find sessions; the userId for guests is a deterministic UUID
    // We delete notes linked to this virtual ID
    await supabase.from("user_notes").delete().eq("target_user_id", userId);
    // Guest wash sessions can't be deleted via client (no RLS policy for delete)
    // So we call the edge function which handles it with service_role
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId, isGuest: true }),
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Errore durante l'eliminazione dell'utente guest");
    }
    return;
  }

  // Registered users — use the existing delete-user edge function
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ userId }),
    }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Errore durante l'eliminazione dell'utente");
  }
};
