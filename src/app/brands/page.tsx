import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { getSiteUrl } from "@/lib/site-url";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: "Our Trusted Brands",
  description:
    "AutoSpare East Africa partners exclusively with the world's finest automotive engineering brands — Mercedes-Benz Genuine, Bosch, Brembo, Bilstein, Sachs, and Lemförder. Certified quality for every part.",
  alternates: {
    canonical: `${siteUrl}/brands`,
  },
};

const partners = [
  { name: "Mercedes-Benz Genuine", desc: "100% original parts with global warranty." },
  { name: "Bosch Automotive",      desc: "Tier-1 electrical and filtration systems." },
  { name: "Brembo",                desc: "High-performance braking solutions." },
  { name: "Bilstein",              desc: "Premium shock absorbers and struts." },
  { name: "Sachs",                 desc: "Expert clutch and suspension technology." },
  { name: "Lemförder",             desc: "Precision steering and chassis components." },
];

export default function BrandsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <section className="py-20 bg-black text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Our <span className="text-primary">Trusted</span> Brands
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              We exclusively partner with the world's finest automotive engineering brands.
            </p>
          </div>
        </section>

        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {partners.map((brand, idx) => (
                <Card key={idx} className="group hover:border-primary transition-all duration-300">
                  <CardContent className="p-10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="h-14 w-14 bg-secondary rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <CheckCircle className="h-8 w-8 text-primary" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Certified Partner
                      </span>
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{brand.name}</h3>
                    <p className="text-muted-foreground leading-relaxed">{brand.desc}</p>
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
