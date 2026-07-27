import axios from "axios";
import { API_ENDPOINTS } from "@/lib/apis";

export function getApiUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (url) {
    return url.replace(/\/$/, "");
  }
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:8000/api";
  }
  throw new Error(
    "[Config Error] NEXT_PUBLIC_API_URL is not defined in environment variables. " +
      "Please specify NEXT_PUBLIC_API_URL in your deployment configuration."
  );
}

const api = axios.create({
  baseURL: getApiUrl(),
  timeout: 60000, // 60 seconds timeout for single-threaded dev server concurrency
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
    // Only redirect on 403s from the admin dashboard routes.
    // Delivery, checkout, and other API 403s (e.g. 24-hour block) must surface
    // as normal rejected promises so the caller can handle them with a toast.
    if (error.response?.status === 403) {
      if (
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/dashboard")
      ) {
        window.location.href = "/account";
      }
    }
    if (error.code === "ECONNABORTED" || error.message?.includes("timeout")) {
      if (error.response) {
        error.response.data = error.response.data || {};
        error.response.data.message = "The request timed out. Please check your network connection or try again later.";
      } else {
        error.response = {
          status: 408,
          statusText: "Request Timeout",
          data: { message: "The request timed out. Please check your network connection or try again later." },
          headers: {},
          config: error.config
        };
      }
    }
    return Promise.reject(error);
  }
);

export default api;

let activeDestinationsPromise: Promise<unknown[]> | null = null;
let countriesPromise: Promise<unknown[]> | null = null;

export const getActiveDestinationsCached = () => {
  if (!activeDestinationsPromise) {
    activeDestinationsPromise = api.get(API_ENDPOINTS.shippingDestinations.active)
      .then((res) => res.data as unknown[])
      .catch((err) => {
        activeDestinationsPromise = null;
        throw err;
      });
  }
  return activeDestinationsPromise;
};

// get countries cached
export const getCountriesCached = () => {
  if (!countriesPromise) {
    countriesPromise = api.get(API_ENDPOINTS.locations.countries)
      .then((res) => res.data as unknown[])
      .catch((err) => {
        countriesPromise = null;
        throw err;
      });
  }
  return countriesPromise;
};

