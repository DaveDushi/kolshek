// Handles ?token= query param authentication via API.
// In production, the server does a redirect to set the cookie.
// In dev mode (Vite proxy on :5173), we exchange the token via
// POST /api/v2/auth/token so the cookie is set on the Vite origin.
import { useEffect, useRef } from "react";

export function useTokenAuth() {
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) return;

    attempted.current = true;

    fetch("/api/v2/auth/token", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => {
        if (res.ok) {
          // Remove the token from the URL without a page reload
          params.delete("token");
          const clean = window.location.pathname + (params.toString() ? `?${params}` : "");
          window.history.replaceState({}, "", clean);
        }
      })
      .catch(() => {
        // Silently ignore — the redirect flow is the fallback
      });
  }, []);
}
