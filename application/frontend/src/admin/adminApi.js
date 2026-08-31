import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../AuthContext.jsx";

function authHeaders(json = false) {
  // JSON content type is added only for requests that contain a JSON body.
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
  };
}

export async function api(path, options = {}) {
  // Normalize admin responses and turn API errors into form-friendly exceptions.
  const response = await authFetch(path, {
    ...options,
    headers: {
      ...authHeaders(Boolean(options.body)),
      ...(options.headers || {}),
    },
  });
  if (response.status === 204) return null;
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(data.message || `The request could not be completed (HTTP ${response.status}).`);
  return data;
}

export function useAdminData(path) {
  // Shared list/detail loader exposes reload after a successful mutation.
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await api(path));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [path]);
  // Loading remote data is the external synchronization performed by this effect.
  useEffect(() => {
    // Loading remote data is the intentional synchronization for this hook.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  return { data, error, loading, reload: load };
}
