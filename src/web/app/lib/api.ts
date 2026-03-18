// Typed fetch wrapper for /api/v2/* endpoints
// All responses follow { success, data, metadata? } envelope

interface ApiSuccess<T> {
  success: true;
  data: T;
  metadata?: Record<string, unknown>;
}

interface ApiError {
  success: false;
  error: { code: string; message: string };
}

type ApiResponse<T> = ApiSuccess<T> | ApiError;

async function parseResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) {
    throw new Error(`Empty response from server (${res.status})`);
  }

  let json: ApiResponse<T>;
  try {
    json = JSON.parse(text);
  } catch {
    // Server returned non-JSON (likely HTML from SPA fallback or error page)
    throw new Error(
      `Server returned non-JSON response (${res.status}): ${text.slice(0, 100)}`
    );
  }

  if (!json.success) {
    throw new Error(json.error.message);
  }
  return json.data;
}

class ApiClient {
  // credentials: "include" ensures cookies are sent for cross-origin requests
  // (Vite dev server on :5173 → API on :3000). Harmless for same-origin production.
  async get<T>(path: string): Promise<T> {
    const res = await fetch(path, { credentials: "include" });
    return parseResponse<T>(res);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(path, {
      method: "POST",
      credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    return parseResponse<T>(res);
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res);
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(path, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseResponse<T>(res);
  }

  async delete<T = null>(path: string): Promise<T> {
    const res = await fetch(path, { method: "DELETE", credentials: "include" });
    return parseResponse<T>(res);
  }
}

export const api = new ApiClient();
