import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({ baseURL: API_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let isRefreshing = false;
let queue = [];

const flushQueue = (error, token) => {
  queue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  queue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const { config, response } = error;

    // authMiddleware.verifyToken responds 403 for an expired/invalid token.
    // Guard against retry-looping the refresh call itself.
    if (
      response?.status === 403 &&
      !config._retry &&
      !config.url?.includes("/auth/refresh") &&
      !config.url?.includes("/auth/login")
    ) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          queue.push({ resolve, reject });
        }).then((token) => {
          config._retry = true;
          config.headers.Authorization = `Bearer ${token}`;
          return api(config);
        });
      }

      config._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {
          token: refreshToken,
        });
        localStorage.setItem("accessToken", data.accessToken);
        flushQueue(null, data.accessToken);
        config.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(config);
      } catch (refreshErr) {
        flushQueue(refreshErr, null);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
