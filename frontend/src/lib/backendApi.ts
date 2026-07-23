const configuredBaseUrl = process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim();
const API_BASE_URL = (configuredBaseUrl || "http://localhost:3001").replace(/\/$/, "");

export class BackendApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "BackendApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: init?.body instanceof FormData
        ? init.headers
        : { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new BackendApiError("Backend API is unavailable", 0);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new BackendApiError(body?.error || `Backend request failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export type Profile = {
  wallet_address: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  avatar_url?: string | null;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type IndexedTransaction = {
  id: number;
  chain_id: number;
  transaction_hash: string;
  log_index: number;
  wallet_address: string | null;
  contract_address: string;
  action: "supply" | "withdraw" | "deposit_collateral" | "withdraw_collateral" | "borrow" | "repay" | "liquidate" | "swap" | "add_liquidity" | "remove_liquidity" | "bridge";
  token_in: string | null;
  token_out: string | null;
  amount_in: string | null;
  amount_out: string | null;
  amount_in_decimals: number | null;
  amount_out_decimals: number | null;
  status: "pending" | "confirmed" | "failed" | "reorged";
  block_number: number;
  block_timestamp: string;
  metadata: Record<string, unknown>;
};

export type ProtocolSnapshot = {
  chain_id: number;
  block_number: number;
  tvl_usd: string;
  total_supplied_usd: string;
  total_borrowed_usd: string;
  swap_volume_usd: string;
  utilization: string | null;
  markets: {
    lending?: Record<string, { address: string; cash: string; supplied: string; borrowed: string; reserves: string; price8: string }>;
    dex?: Record<string, { address: string; reserve0: string; reserve1: string }>;
    lending_tvl_usd?: number;
    dex_tvl_usd?: number;
  };
  captured_at: string;
};

export type Conversation = {
  id: string;
  wallet_address: string;
  title: string;
  model: string | null;
  is_archived: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type StoredMessage = {
  id: string;
  conversation_id: string;
  sequence_no: number;
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  parts: unknown[];
  metadata: Record<string, unknown>;
  created_at: string;
};

const wallet = (address: string) => address.toLowerCase();
const query = (params: Record<string, string | number | boolean | undefined>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => value !== undefined && search.set(key, String(value)));
  return search.toString();
};

export const backendApi = {
  profile: (address: string) => request<{ profile: Profile }>(`/api/profiles/${wallet(address)}`),
  updateProfile: (address: string, input: { displayName?: string | null; bio?: string | null; preferences?: Record<string, unknown> }) =>
    request<{ profile: Profile }>(`/api/profiles/${wallet(address)}`, { method: "PUT", body: JSON.stringify(input) }),
  uploadAvatar: (address: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ avatarPath: string; avatarUrl: string }>(`/api/profiles/${wallet(address)}/avatar`, { method: "POST", body: form });
  },
  transactions: (address: string, limit = 50, cursor?: number) =>
    request<{ items: IndexedTransaction[]; nextCursor: number | null }>(`/api/transactions/${wallet(address)}?${query({ limit, cursor })}`),
  protocolStats: (chainId = 5042002) =>
    request<{ stats: ProtocolSnapshot | null }>(`/api/protocol/stats?${query({ chainId })}`),
  protocolHistory: (chainId = 5042002, limit = 30) =>
    request<{ items: ProtocolSnapshot[] }>(`/api/protocol/history?${query({ chainId, limit })}`),
  conversations: (address: string, limit = 50) =>
    request<{ items: Conversation[]; nextCursor: string | null }>(`/api/chat/conversations?${query({ walletAddress: wallet(address), limit })}`),
  createConversation: (address: string, title: string) =>
    request<{ conversation: Conversation }>("/api/chat/conversations", { method: "POST", body: JSON.stringify({ walletAddress: wallet(address), title }) }),
  deleteConversation: (id: string, address: string) =>
    request<void>(`/api/chat/conversations/${id}?${query({ walletAddress: wallet(address) })}`, { method: "DELETE" }),
  messages: (conversationId: string, address: string) =>
    request<{ items: StoredMessage[] }>(`/api/chat/conversations/${conversationId}/messages?${query({ walletAddress: wallet(address) })}`),
  appendMessage: (conversationId: string, address: string, message: { role: "system" | "user" | "assistant" | "tool"; content?: string | null; parts?: unknown[]; metadata?: Record<string, unknown> }) =>
    request<{ message: StoredMessage }>(`/api/chat/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ walletAddress: wallet(address), parts: [], metadata: {}, ...message }),
    }),
};
