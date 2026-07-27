import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FaqAccordion, type FaqItem } from "./FaqAccordion";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://autospare-eastafrica.com";

// ── Per-page metadata ────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "Frequently Asked Questions",
  description:
    "Find answers to common questions about AutoSpare East Africa's genuine Mercedes-Benz parts, delivery coverage across Kenya, Uganda, Tanzania, Rwanda and Burundi, order tracking, and our 14-day returns policy.",
  alternates: {
    canonical: `${siteUrl}/faq`,
  },
};

// ── FAQ data — single source of truth for render and JSON-LD ────────────────
const faqs: FaqItem[] = [
  {
    q: "Are your parts genuine Mercedes-Benz?",
    a: "Yes, we import 100% genuine parts directly from authorized Mercedes-Benz distributors in Germany. We also offer high-quality certified aftermarket parts from Tier-1 brands like Bosch and Brembo.",
  },
  {
    q: "Do you ship across East Africa?",
    a: "Absolutely. We have a robust logistics network covering Kenya, Uganda, Tanzania, Rwanda, and Burundi. Delivery times range from 24 to 72 hours depending on the location.",
  },
  {
    q: "Can I track my order?",
    a: "Yes. Once an order is processed, you'll receive a tracking number that can be used on our Partner Portal or directly with our logistics partners.",
  },
  {
    q: "What is your return policy?",
    a: "Genuine parts can be returned within 14 days if they are unopened and in their original packaging. Electronic components are subject to testing before a refund is issued.",
  },
];

// ── FAQPage JSON-LD structured data ─────────────────────────────────────────
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.a,
    },
  })),
};

// ── Server Component — no "use client" ──────────────────────────────────────
export default function FAQPage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* FAQPage structured data injected server-side into the HTML document */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <Navbar />
      <main className="flex-1">
        <section className="py-20 bg-secondary">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-muted-foreground">
              Everything you need to know about our parts and distribution.
            </p>
          </div>
        </section>

        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            {/* Client Component — owns only the accordion open/close state */}
            <FaqAccordion faqs={faqs} />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
