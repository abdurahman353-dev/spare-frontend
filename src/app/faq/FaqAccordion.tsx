"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export interface FaqItem {
  q: string;
  a: string;
}

export function FaqAccordion({ faqs }: { faqs: FaqItem[] }) {
  return (
    <Accordion className="w-full">
      {faqs.map((faq, i) => (
        <AccordionItem key={i} value={`item-${i}`}>
          <AccordionTrigger className="text-left text-lg font-bold">
            {faq.q}
          </AccordionTrigger>
          <AccordionContent className="text-muted-foreground text-md leading-relaxed">
            {faq.a}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
