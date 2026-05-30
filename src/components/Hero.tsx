"use client";

import { motion } from "framer-motion";
import { Zap } from "lucide-react";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/providers/SettingsProvider";

export const Hero = () => {
  const { settings } = useSettings();
  const brandName = settings.store_name || "";
  const tagline = settings.store_tagline || "";
  const description = settings.store_description || "";

  return (
    <section className="relative h-[90vh] flex items-center bg-zinc-950 overflow-hidden">
      {/* Background Video Layer */}
      <div className="absolute inset-0 z-0">
        <video 
          autoPlay 
          muted 
          loop 
          playsInline
          className="w-full h-full object-cover opacity-80"
        >
          <source src="https://res.cloudinary.com/dgpykm8wo/video/upload/v1780093914/hero/u2ujfotnzi7ewl1lqqot.mp4" type="video/mp4" />
        </video>
        {/* Overlay Gradients to ensure text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/80 via-zinc-950/40 to-transparent z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-transparent to-transparent z-10" />
      </div>
      
      <div className="container mx-auto px-4 z-20 relative">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl"
        >
          {brandName && (
            <div className="flex items-center gap-2 mb-8">
              <span className="h-px w-12 bg-[#0052cc]"></span>
              <span className="text-[#0052cc] font-bold tracking-[0.2em] text-sm uppercase">{brandName}</span>
            </div>
          )}
          
          {tagline && (
            <h1 className="text-6xl md:text-8xl font-black text-white mb-8 leading-[0.95] tracking-tight">
              {tagline.toUpperCase() === "GENUINE PRECISION." || tagline.toUpperCase() === "GENUINE PRECISION" ? (
                <>
                  GENUINE <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">PRECISION.</span>
                </>
              ) : tagline}
            </h1>
          )}
          
          {description && (
            <p className="text-xl md:text-2xl text-zinc-400 mb-12 max-w-2xl font-medium leading-relaxed">
              {description}
            </p>
          )}
          
          <div className="flex flex-wrap gap-6">
            <Link 
              href="/products" 
              className={cn(buttonVariants({ size: "lg" }), "h-16 px-10 text-lg font-black rounded-sm bg-[#0052cc] text-white hover:bg-white hover:text-black transition-all duration-300 shadow-2xl shadow-blue-500/20")}
            >
              EXPLORE CATALOG
            </Link>
            <Link 
              href="/contact" 
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-16 px-10 text-lg font-bold rounded-sm border-white/20 bg-white/5 text-white backdrop-blur-xl hover:bg-white hover:text-black transition-all duration-300")}
            >
              PARTNER PORTAL
            </Link>
          </div>

          <div className="mt-16 flex items-center gap-12 text-zinc-500">
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">10K+</span>
              <span className="text-xs uppercase tracking-widest font-bold">SKUs In Stock</span>
            </div>
            <div className="h-8 w-px bg-zinc-800"></div>
            <div className="flex flex-col">
              <span className="text-2xl font-bold text-white">24H</span>
              <span className="text-xs uppercase tracking-widest font-bold">Rapid Dispatch</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};