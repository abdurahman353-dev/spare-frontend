import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Truck, Warehouse, BadgeCheck, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://autospare-eastafrica.com";

export const metadata: Metadata = {
  title: "Enterprise Services",
  description:
    "AutoSpare East Africa offers enterprise-grade automotive services: regional door-to-door distribution, bulk warehousing, German-standard quality assurance, and data-driven market analytics for wholesale partners across East Africa.",
  alternates: {
    canonical: `${siteUrl}/services`,
  },
};

const services = [
  {
    icon: Truck,
    title: "Regional Distribution",
    desc: "Door-to-door delivery across the entire East African region with optimized route planning.",
  },
  {
    icon: Warehouse,
    title: "Bulk Warehousing",
    desc: "Secure, climate-controlled storage for large inventory batches for wholesale partners.",
  },
  {
    icon: BadgeCheck,
    title: "Quality Assurance",
    desc: "Rigorous testing of all incoming shipments to ensure strict adherence to German engineering standards.",
  },
  {
    icon: BarChart3,
    title: "Market Analytics",
    desc: "We provide our partners with data-driven insights on regional part demand and pricing trends.",
  },
];

export default function ServicesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <section className="py-20 bg-black text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold mb-4">Enterprise Services</h1>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Scaling automotive supply chains with precision and reliability.
            </p>
          </div>
        </section>

        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {services.map((s, i) => (
                <Card key={i} className="border-none bg-secondary/50 p-8">
                  <CardContent className="p-0">
                    <s.icon className="h-12 w-12 text-primary mb-6" />
                    <h3 className="text-2xl font-bold mb-3">{s.title}</h3>
                    <p className="text-muted-foreground text-lg leading-relaxed">{s.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
