import { createClient } from "@/lib/supabase/server";

// Server-side base URL for the Go API. In Docker the web container reaches the
// api service by name (http://api:8080); GO_API_URL is injected per environment.
const GO_API_URL = process.env.GO_API_URL ?? "http://localhost:8180";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Pull the caller's Supabase access token from the SSR session. The token is a
// standard JWT that the Go API verifies via JWKS, so it can be forwarded as-is.
async function getAccessToken(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

interface ApiInit {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: ApiInit["query"]): string {
  const url = new URL(`${GO_API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

/**
 * Call the Go API on behalf of the signed-in user. Server-only: the access
 * token never reaches the browser. Throws ApiError with the Go API's status and
 * message on a non-2xx response.
 */
export async function apiFetch<T>(path: string, init: ApiInit = {}): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError(401, "Unauthorized");

  const res = await fetch(buildUrl(path, init.query), {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data && typeof data.error === "string") message = data.error;
    } catch {
      // response body was not JSON; keep the generic message
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
