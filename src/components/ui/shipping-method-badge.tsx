"use client";

import React from "react";
import { Zap, Package, Store, Truck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShippingMethodBadgeProps {
  method?: string | null;
  className?: string;
  showIcon?: boolean;
}

export function ShippingMethodBadge({ method, className, showIcon = true }: ShippingMethodBadgeProps) {
  const methodStr = (method || "").trim();
  const lower = methodStr.toLowerCase();

  const isExpress = lower.includes("express");
  const isPickup = lower.includes("pickup") || lower.includes("counter") || lower.includes("in-store") || lower.includes("collection");
  const isLocal = lower.includes("local") || lower.includes("dispatch");

  if (isExpress) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25 shadow-xs shrink-0",
          className
        )}
      >
        {showIcon && <Zap className="h-3.5 w-3.5 fill-amber-500 text-amber-500 shrink-0" />}
        <span>⚡ Express</span>
      </span>
    );
  }

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

  if (isLocal) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25 shrink-0",
          className
        )}
      >
        {showIcon && <Truck className="h-3.5 w-3.5 text-sky-500 shrink-0" />}
        <span>Local Dispatch</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 shrink-0",
        className
      )}
    >
      {showIcon && <Package className="h-3.5 w-3.5 text-indigo-500 shrink-0" />}
      <span>📦 Standard</span>
    </span>
  );
}
