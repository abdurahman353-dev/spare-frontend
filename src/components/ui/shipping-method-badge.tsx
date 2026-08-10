"use client";

import React from "react";
import { Store, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShippingMethodBadgeProps {
  method?: string | null;
  className?: string;
  showIcon?: boolean;
}

export function ShippingMethodBadge({ method, className, showIcon = true }: ShippingMethodBadgeProps) {
  const methodStr = (method || "").trim();
  const lower = methodStr.toLowerCase();

  const isPickup = lower.includes("pickup") || lower.includes("counter") || lower.includes("in-store") || lower.includes("collection");

  if (isPickup) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 shrink-0",
          className
        )}
      >
        {showIcon && <Store className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
        <span>In-Store Pickup</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25 shrink-0",
        className
      )}
    >
      {showIcon && <Truck className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
      <span>Local Dispatch</span>
    </span>
  );
}
