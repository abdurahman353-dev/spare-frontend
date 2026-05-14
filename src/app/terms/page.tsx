"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function TermsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <p>By accessing this website, you agree to comply with our business terms regarding part ordering and distribution.</p>
            <h2 className="text-xl font-bold text-foreground">1. Ordering</h2>
            <p>All orders placed through the partner portal are subject to stock availability and regional shipping constraints.</p>
            <h2 className="text-xl font-bold text-foreground">2. Liability</h2>
            <p>AutoSpare East Africa is not liable for incorrect installation of parts by third-party garages. We recommend installation only by certified Mercedes-Benz specialists.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
