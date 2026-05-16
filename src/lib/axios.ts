import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }
    }
    // If a non-admin hits an admin route (403), redirect them to their customer portal
    if (error.response?.status === 403) {
      if (typeof window !== "undefined" && !window.location.pathname.includes('/account')) {
        window.location.href = "/account";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
