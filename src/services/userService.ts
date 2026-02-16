import { supabase } from "@/integrations/supabase/client";

export interface InviteUserPayload {
  email: string;
  firstName: string;
  lastName: string;
  role: "partner" | "manager";
  structureId?: string;
  stationIds?: string[];
}

export interface InviteUserResult {
  tempPassword: string;
}

export const inviteUser = async (payload: InviteUserPayload): Promise<InviteUserResult> => {
  const body: Record<string, any> = {
    email: payload.email,
    firstName: payload.firstName,
    lastName: payload.lastName,
    role: payload.role,
  };
  if (payload.role === "manager" && payload.structureId) {
    body.structureId = payload.structureId;
  }
  if (payload.role === "partner" && payload.stationIds?.length) {
    body.stationIds = payload.stationIds;
  }

  const { data, error } = await supabase.functions.invoke("invite-user", { body });
  if (error) {
    const msg = data?.error || error.message || "Errore sconosciuto";
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return { tempPassword: data.tempPassword };
};

export const deleteUser = async (userId: string) => {
  const { data, error } = await supabase.functions.invoke("delete-user", {
    body: { userId },
  });
  if (error) {
    const msg = typeof data === "object" && data?.error ? data.error : error.message;
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data;
};
