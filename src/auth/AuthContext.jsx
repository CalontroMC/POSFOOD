import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Auth, apiGet } from "../lib/api.js";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(Auth.hasToken());
  const [role, setRole] = useState(null);
  const [employeeName, setEmployeeName] = useState(null);
  const [checking, setChecking] = useState(true);
  const [firstRun, setFirstRun] = useState(null); // null | true | false

  const refresh = useCallback(async () => {
    try {
      const { first_run } = await apiGet("/auth/setup-status", { auth: false, silent401: true });
      setFirstRun(!!first_run);
      if (first_run) {
        setAuthed(false);
        setChecking(false);
        return;
      }
      if (Auth.hasToken()) {
        const res = await Auth.me();
        setAuthed(res.authenticated);
        setRole(res.role);
        setEmployeeName(res.employeeName);
      } else {
        setAuthed(false);
        setRole(null);
        setEmployeeName(null);
      }
    } catch {
      // backend unreachable; assume not first-run
      setFirstRun(false);
      setAuthed(Auth.hasToken());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const onExpired = () => setAuthed(false);
    window.addEventListener("foodpos:auth-expired", onExpired);
    return () => window.removeEventListener("foodpos:auth-expired", onExpired);
  }, [refresh]);

  const login = useCallback(async (pin, roleMode, employeeId) => {
    const res = await Auth.login(pin, roleMode, employeeId);
    if (res.role) {
      setRole(res.role);
      setEmployeeName(res.employeeName);
    }
    setAuthed(true);
  }, []);

  const logout = useCallback(async () => {
    await Auth.logout();
    setAuthed(false);
    setRole(null);
    setEmployeeName(null);
  }, []);

  const onSetupDone = useCallback(() => {
    setFirstRun(false);
    setAuthed(true);
  }, []);

  return (
    <AuthCtx.Provider value={{ authed, role, employeeName, checking, firstRun, login, logout, onSetupDone, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
