import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";
import { getSocket } from "../lib/socket";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await api.get("/notifications/");
    setNotifications(data.notifications || []);
  }, [user]);

  useEffect(() => {
    if (user) fetchNotifications();
    else setNotifications([]);
  }, [user, fetchNotifications]);

  useEffect(() => {
    if (!user) return;
    const socket = getSocket();

    const onNotification = (payload) => {
      setNotifications((prev) => [{ ...payload, is_read: false, created_at: new Date().toISOString() }, ...prev]);
      const toastId = `${payload.id}-${Date.now()}`;
      setToasts((prev) => [...prev, { ...payload, toastId }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
      }, 5000);
    };

    socket.on("notification", onNotification);
    return () => socket.off("notification", onNotification);
  }, [user]);

  const markAsRead = async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    await api.put(`/notifications/${id}/read`);
  };

  const dismissToast = (toastId) => {
    setToasts((prev) => prev.filter((t) => t.toastId !== toastId));
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <NotificationContext.Provider
      value={{ notifications, toasts, unreadCount, fetchNotifications, markAsRead, dismissToast }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => useContext(NotificationContext);
