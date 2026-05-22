"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import api from "@/lib/axios";

interface SettingsContextType {
  settings: Record<string, string>;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: {},
  loading: true,
  refreshSettings: async () => {},
});

export const useSettings = () => useContext(SettingsContext);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await api.get("/settings");
      setSettings(response.data);
    } catch (error) {
      console.error("Failed to load global settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-zinc-950 z-50 flex flex-col items-center justify-center gap-6 overflow-hidden">
        {/* Luxury gradient ambient background glow */}
        <div className="absolute w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        
        {/* Double-spinning luxury ring loader */}
        <div className="relative w-24 h-24 flex items-center justify-center">
          {/* Static track ring */}
          <div className="absolute border border-zinc-900 rounded-full w-full h-full" />
          
          {/* Inner ring spinning clockwise */}
          <div className="absolute border-t-2 border-r-2 border-t-primary border-r-primary/30 border-b-transparent border-l-transparent rounded-full w-full h-full animate-[spin_1.2s_linear_infinite]" />
          
          {/* Outer ring spinning counter-clockwise */}
          <div className="absolute border-b border-l border-b-primary border-l-primary/10 border-t-transparent border-r-transparent rounded-full w-[115%] h-[115%] animate-[spin_1.8s_linear_infinite_reverse]" />
          
          {/* Pulsing high-fidelity premium core */}
          <div className="absolute animate-pulse flex items-center justify-center">
            {/* Elegant metallic 3-pointed luxury star */}
            <svg className="w-10 h-10 text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.7)]" viewBox="0 0 100 100" fill="currentColor">
              <path d="M50 8 L55 45 L92 50 L55 55 L50 92 L45 55 L8 50 L45 45 Z" />
            </svg>
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-2 z-10 text-center">
          <h2 className="text-white font-black text-xs uppercase tracking-[0.3em] drop-shadow-md">
            Initializing System
          </h2>
          <p className="text-zinc-500 font-black text-[9px] uppercase tracking-[0.18em] animate-pulse">
            Syncing premium settings & network
          </p>
        </div>
      </div>
    );
  }

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}
