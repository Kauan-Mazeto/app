import { createContext, useContext, useEffect, useState } from "react";
import { api, formatError } from "@/lib/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null=loading, false=guest, obj=logged
  const [error, setError] = useState("");

  const fetchMe = async () => {
    const token = localStorage.getItem("sc_token");
    if (!token) {
      setUser(false);
      return;
    }

    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch (e) {
      if (e.response?.status === 401) {
        localStorage.removeItem("sc_token");
      }
      setUser(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const login = async (email, password) => {
    setError("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      if (data.token) localStorage.setItem("sc_token", data.token);
      setUser(data);
      return data;
    } catch (e) {
      const msg = formatError(e.response?.data?.detail) || e.message;
      setError(msg);
      throw new Error(msg);
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {}
    localStorage.removeItem("sc_token");
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, login, logout, error, refresh: fetchMe }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
