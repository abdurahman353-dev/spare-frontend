"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const HubMapContent = dynamic(() => import("./HubMapContent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[350px] bg-zinc-50 rounded-2xl flex flex-col items-center justify-center border border-zinc-200 gap-2">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="text-xs text-zinc-400 font-semibold">Initializing Interactive Map...</span>
    </div>
  )
});

export function HubMap() {
  return <HubMapContent />;
}
