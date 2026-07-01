import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { toast } from "react-hot-toast"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function toastErrors(err: any, fallbackMessage: string = "An error occurred") {
  if (err.response?.data?.errors) {
    const errorData = err.response.data.errors;
    Object.keys(errorData).forEach((field) => {
      const messages = errorData[field];
      if (Array.isArray(messages)) {
        messages.forEach((msg) => {
          toast.error(msg, { duration: 5000 });
        });
      } else if (typeof messages === "string") {
        toast.error(messages, { duration: 5000 });
      }
    });
  } else if (err.response?.data?.message) {
    toast.error(err.response.data.message);
  } else {
    toast.error(fallbackMessage);
  }
}

export function getCategoryColor(categoryName: string) {
  const name = (categoryName || "").toLowerCase().trim();
  
  if (name.includes("elect") || name.includes("battery") || name.includes("sensor")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  if (name.includes("engine") || name.includes("motor") || name.includes("filter")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (name.includes("brake") || name.includes("pad") || name.includes("disc")) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (name.includes("suspension") || name.includes("shock") || name.includes("strut")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (name.includes("body") || name.includes("bumper") || name.includes("mirror")) {
    return "bg-purple-50 text-purple-700 border-purple-200";
  }
  if (name.includes("transmission") || name.includes("gear") || name.includes("clutch")) {
    return "bg-indigo-50 text-indigo-700 border-indigo-200";
  }
  if (name.includes("exhaust") || name.includes("pipe") || name.includes("muffler")) {
    return "bg-zinc-100 text-zinc-800 border-zinc-300";
  }
  
  const colors = [
    "bg-blue-50 text-blue-700 border-blue-200",
    "bg-emerald-50 text-emerald-700 border-emerald-200",
    "bg-indigo-50 text-indigo-700 border-indigo-200",
    "bg-purple-50 text-purple-700 border-purple-200",
    "bg-pink-50 text-pink-700 border-pink-200",
    "bg-amber-50 text-amber-700 border-amber-200",
    "bg-teal-50 text-teal-700 border-teal-200",
    "bg-cyan-50 text-cyan-700 border-cyan-200",
  ];
  
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

