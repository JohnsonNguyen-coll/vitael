import { supabase } from "./supabase.js";

export async function ensureProfile(walletAddress: string) {
  const { error } = await supabase
    .from("profiles")
    .upsert({ wallet_address: walletAddress }, { onConflict: "wallet_address", ignoreDuplicates: true });
  if (error) throw error;
}
