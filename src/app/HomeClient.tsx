"use client";

import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  ShieldCheck,
  Truck,
  Package,
  Star,
  UserPlus,
  Search,
  CreditCard,
  PackageCheck,
  Zap,
  MapPin,
} from "lucide-react";
import { HubMap } from "@/components/HubMap";

export function HomeHighlights() {
  return (
    <section className="py-20 bg-secondary/30">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {[
            { title: "Genuine Parts", icon: ShieldCheck, desc: "100% authentic OEM & aftermarket parts." },
            { title: "Fast Distribution", icon: Truck, desc: "Regional logistics network for quick delivery." },
            { title: "Large Inventory", icon: Package, desc: "Over 10,000+ SKUs in stock." },
            { title: "Trusted Supplier", icon: Star, desc: "20+ years of wholesale experience." },
          ].map((highlight, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className="bg-white border-none shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="h-12 w-12 bg-zinc-50 rounded-lg flex items-center justify-center mb-4">
                    <highlight.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 text-zinc-900">{highlight.title}</h3>
                  <p className="text-zinc-500 text-sm leading-relaxed">{highlight.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function HomeJourney() {
  return (
    <section className="py-24 bg-white relative overflow-hidden">
      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-20">
          <h2 className="text-4xl md:text-5xl font-black text-zinc-900 mb-6 tracking-tight">
            Your Journey to <span className="text-primary italic">Precision.</span>
          </h2>
          <p className="text-zinc-500 max-w-2xl mx-auto text-lg font-medium">
            From Stuttgart to your doorstep. Follow these simple steps to master your parts procurement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 relative">
          <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-zinc-100 -translate-y-1/2 z-0" />

          {[
            {
              step: "01",
              title: "Join the Network",
              desc: "Register your business profile and gain instant access to our wholesale tier pricing.",
              icon: UserPlus,
            },
            {
              step: "02",
              title: "Precision Selection",
              desc: "Browse our live Stuttgart-imported inventory with real-time stock levels and technical data.",
              icon: Search,
            },
            {
              step: "03",
              title: "Swift Settlement",
              desc: "Secure your selection with multiple payment options and priority administrative handling.",
              icon: CreditCard,
            },
            {
              step: "04",
              title: "Rapid Receipt",
              desc: "Track your waybill through our regional logistics hubs directly to your distribution point.",
              icon: PackageCheck,
            },
          ].map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.2 }}
              className="relative z-10 flex flex-col items-center text-center group"
            >
              <div className="relative mb-8">
                <div className="h-20 w-20 bg-blue-50 rounded-3xl flex items-center justify-center text-[#0052cc] shadow-sm group-hover:bg-[#0052cc] group-hover:text-white transition-all duration-500">
                  <item.icon className="h-8 w-8" />
                </div>
                <div className="absolute -top-3 -right-3 h-8 w-8 bg-[#0052cc] rounded-full border-4 border-white flex items-center justify-center text-[10px] font-black text-white">
                  {item.step}
                </div>
              </div>
              <h3 className="text-xl font-bold text-zinc-900 mb-3 group-hover:text-[#0052cc] transition-colors">
                {item.title}
              </h3>
              <p className="text-zinc-500 text-sm font-medium leading-relaxed px-4">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-20 text-center">
          <Link href="/register">
            <Button size="lg" className="h-14 px-10 rounded-full font-black text-xs uppercase tracking-widest bg-[#0052cc] hover:bg-[#0747a6] text-white transition-all shadow-xl shadow-blue-200 animate-blink">
              Get Started Now <Zap className="ml-2 h-4 w-4 fill-current" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HomeDistributionMap({ countriesList }: { countriesList: string[] }) {
  if (!countriesList || countriesList.length === 0) return null;

  return (
    <section className="py-24 bg-secondary">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="lg:w-1/2">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Regional Distribution points</h2>
            <p className="text-lg text-muted-foreground mb-8">
              We operate multiple distribution centers across East Africa to ensure your parts arrive exactly when you need them.
            </p>
            <ul className="space-y-4">
              {countriesList.map((country) => {
                const isHq = country.includes("(HQ)");
                const cleanName = country.replace(" (HQ)", "");
                return (
                  <li key={country} className="flex items-center gap-3.5 group cursor-default">
                    <div className="h-8 w-8 rounded-lg bg-blue-50/50 group-hover:bg-blue-100 flex items-center justify-center transition-all duration-300 shrink-0 border border-zinc-100">
                      <MapPin className="h-4 w-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-lg text-zinc-700 group-hover:translate-x-1 group-hover:text-zinc-900 transition-all duration-300 flex items-center gap-2">
                      <span>{cleanName}</span>
                      {isHq && (
                        <span className="text-[10px] bg-blue-50/80 text-blue-600 font-extrabold px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-wider">
                          HQ
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="lg:w-1/2 w-full h-[350px] z-0">
            <HubMap />
          </div>
        </div>
      </div>
    </section>
  );
}
