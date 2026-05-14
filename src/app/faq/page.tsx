"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function FAQPage() {
  const faqs = [
    { q: "Are your parts genuine Mercedes-Benz?", a: "Yes, we import 100% genuine parts directly from authorized Mercedes-Benz distributors in Germany. We also offer high-quality certified aftermarket parts from Tier-1 brands like Bosch and Brembo." },
    { q: "Do you ship across East Africa?", a: "Absolutely. We have a robust logistics network covering Kenya, Uganda, Tanzania, Rwanda, and Burundi. Delivery times range from 24 to 72 hours depending on the location." },
    { q: "Can I track my order?", a: "Yes. Once an order is processed, you'll receive a tracking number that can be used on our Partner Portal or directly with our logistics partners." },
    { q: "What is your return policy?", a: "Genuine parts can be returned within 14 days if they are unopened and in their original packaging. Electronic components are subject to testing before a refund is issued." },
  ];

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <section className="py-20 bg-secondary">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
            <p className="text-muted-foreground">Everything you need to know about our parts and distribution.</p>
          </div>
        </section>

        <section className="py-24 bg-background">
          <div className="container mx-auto px-4 max-w-3xl">
            <Accordion className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`}>
                  <AccordionTrigger className="text-left text-lg font-bold">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-md leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
