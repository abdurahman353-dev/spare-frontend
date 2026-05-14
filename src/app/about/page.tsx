"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { motion } from "framer-motion";
import { ShieldCheck, Users, Globe, Award } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <section className="py-20 bg-black text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Our Legacy in <span className="text-primary">Excellence</span></h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              AutoSpare East Africa is the leading distributor of genuine Mercedes-Benz parts, bridging the gap between German engineering and African roads.
            </p>
          </div>
        </section>

        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-6">Over 20 Years of Specialized Service</h2>
                <p className="text-lg text-muted-foreground mb-6">
                  Founded with a vision to provide reliable, high-performance parts for Mercedes-Benz enthusiasts and professionals, we have grown into the region's largest logistics hub for automotive spares.
                </p>
                <p className="text-lg text-muted-foreground">
                  We understand that a Mercedes-Benz is more than just a car—it's a masterpiece of engineering. That's why we never compromise on quality, sourcing every bolt and engine block directly from certified German suppliers.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                {[
                  { icon: ShieldCheck, label: "Genuine Parts Only", value: "100%" },
                  { icon: Users, label: "Active Partners", value: "850+" },
                  { icon: Globe, label: "Regional Hubs", value: "5" },
                  { icon: Award, label: "Years Experience", value: "22" },
                ].map((stat, idx) => (
                  <div key={idx} className="bg-secondary p-8 rounded-2xl text-center">
                    <stat.icon className="h-8 w-8 text-primary mx-auto mb-4" />
                    <div className="text-3xl font-bold mb-1">{stat.value}</div>
                    <div className="text-sm text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
