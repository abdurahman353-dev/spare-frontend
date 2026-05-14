"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function PrivacyPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 py-20 bg-background">
        <div className="container mx-auto px-4 max-w-4xl">
          <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
          <div className="prose prose-zinc dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <p>At AutoSpare East Africa, we value your privacy. This policy outlines how we collect and use your data when you use our partner portal or public website.</p>
            <h2 className="text-xl font-bold text-foreground">1. Data Collection</h2>
            <p>We collect information necessary to process orders and verify partnership status, including names, business addresses, and contact details.</p>
            <h2 className="text-xl font-bold text-foreground">2. Usage</h2>
            <p>Your data is used solely for logistics, order fulfillment, and account management. We do not sell your information to third parties.</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
