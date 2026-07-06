import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { getSocket } from "../lib/socket";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  const persistSession = useCallback((accessToken, refreshToken, userObj) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("user", JSON.stringify(userObj));
    setUser(userObj);
  }, []);

  // Connect the socket room whenever we have a logged-in user.
  useEffect(() => {
    const socket = getSocket();
    if (user?.id) {
      socket.connect();
      socket.emit("join", user.id);
    }
    return () => {
      if (!user?.id) socket.disconnect();
    };
  }, [user?.id]);

  const login = async (email, password, loginType) => {
  setLoading(true);
  try {
    const { data } = await api.post("/auth/login", { email, password, loginType });
      if (data.must_set_password) {
        return { mustSetPassword: true, userId: data.userId, email: data.email };
      }
      persistSession(data.accessToken, data.refreshToken, data.user);
      return {
        mustSetPassword: false,
        mustChangePassword: data.must_change_password,
      };
    } finally {
      setLoading(false);
    }
  };

  const register = async (payload) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", payload);
      return data;
    } finally {
      setLoading(false);
    }
  };

  const setPassword = async (userId, password) => {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/set-password", { userId, password });
      persistSession(data.accessToken, data.refreshToken, data.user);
      return data;
    } finally {
      setLoading(false);
    }
  };

  // Now requires the account's current password — the backend verifies it
  // with bcrypt before allowing the change (see authController.changePassword).
  const changePassword = async (currentPassword, newPassword) => {
    const { data } = await api.put("/auth/change-password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
    if (user) {
      const updated = { ...user };
      localStorage.setItem("user", JSON.stringify(updated));
      setUser(updated);
    }
    return data;
  };

  const setSessionFromOAuth = (accessToken, refreshToken, userObj) => {
    persistSession(accessToken, refreshToken, userObj);
  };

  const logout = async () => {
  try {
    await api.delete("/settings/security/session");
  } catch {
    // best-effort -- still clear local session even if the request fails
  }
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("user");
  getSocket().disconnect();
  setUser(null);
};

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        setPassword,
        changePassword,
        setSessionFromOAuth,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
