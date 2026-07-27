import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, ShieldCheck, Truck, Package } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Hero } from "@/components/Hero";
import { HomeHighlights, HomeJourney, HomeDistributionMap } from "./HomeClient";
import { getApiUrl } from "@/lib/axios";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "AutoSpare East Africa | Genuine Auto Spare Parts & Fast Dispatch",
  description:
    "Premium Mercedes-Benz and commercial vehicle spare parts distribution across East Africa. Quality filters, engine components, brake systems, and fast dispatch in Kenya, Uganda, Tanzania, Rwanda, and Burundi.",
  alternates: {
    canonical: siteUrl,
  },
};

const categories = [
  { name: "Engine Parts", icon: Wrench, desc: "Pistons, valves, and timing belts" },
  { name: "Brake System", icon: ShieldCheck, desc: "Pads, rotors, and calipers" },
  { name: "Suspension", icon: Truck, desc: "Shocks, struts, and control arms" },
  { name: "Electrical", icon: Package, desc: "Alternators, starters, and sensors" },
];

async function getCountriesList(): Promise<string[]> {
  try {
    const apiUrl = getApiUrl();
    const [destResponse, locResponse] = await Promise.all([
      fetch(`${apiUrl}/shipping-destinations/active`, { next: { revalidate: 300 } }).then((r) => r.json()).catch(() => []),
      fetch(`${apiUrl}/locations/countries`, { next: { revalidate: 300 } }).then((r) => r.json()).catch(() => []),
    ]);

    const activeDestinations = Array.isArray(destResponse) ? destResponse : destResponse?.data || [];
    const realLocations = Array.isArray(locResponse) ? locResponse : locResponse?.data || [];

    const uniqueCountries = new Set<string>();
    activeDestinations.forEach((dest: any) => {
      if (dest.country) uniqueCountries.add(dest.country.trim());
    });
    realLocations.forEach((loc: any) => {
      if (loc.name && loc.is_active !== false) uniqueCountries.add(loc.name.trim());
    });

    const list: string[] = [];
    uniqueCountries.forEach((country) => {
      const isHQ = country.toLowerCase() === "kenya";
      list.push(`${country}${isHQ ? " (HQ)" : ""}`);
    });

    if (list.length > 0) {
      list.sort((a, b) => {
        if (a.includes("(HQ)")) return -1;
        if (b.includes("(HQ)")) return 1;
        return a.localeCompare(b);
      });
    }
    return list;
  } catch (e) {
    console.error("Failed to fetch countries for home server-side:", e);
    return [];
  }
}

export default async function Home() {
  const countriesList = await getCountriesList();

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />

      <main className="flex-1">
        <Hero />
        <HomeHighlights />
        <HomeJourney />

        {/* Categories Section */}
        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Our Product Categories</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                Comprehensive range of Mercedes-Benz parts for all models and years.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {categories.map((cat, idx) => (
                <Card key={idx} className="group cursor-pointer hover:border-primary transition-colors">
                  <CardContent className="p-8 text-center flex flex-col items-center">
                    <div className="h-16 w-16 rounded-full bg-secondary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <cat.icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">{cat.name}</h3>
                    <p className="text-sm text-muted-foreground">{cat.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="text-center mt-12">
              <Link
                href="/products"
                className={cn(buttonVariants({ variant: "default", size: "lg" }), "bg-blue-600 hover:bg-blue-700 text-white font-bold animate-blink")}
              >
                View All Categories
              </Link>
            </div>
          </div>
        </section>

        <HomeDistributionMap countriesList={countriesList} />
      </main>

      <Footer />
    </div>
  );
}
