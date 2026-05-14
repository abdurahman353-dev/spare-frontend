"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <section className="py-20 bg-black text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">Contact Our <span className="text-primary">Experts</span></h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Have a specific part request or interested in becoming a dealer? We're here to help.
            </p>
          </div>
        </section>

        <section className="py-24 bg-background">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              {/* Contact Form */}
              <div className="space-y-8">
                <div className="space-y-4">
                  <h2 className="text-3xl font-bold">Send us a message</h2>
                  <p className="text-muted-foreground text-lg">We usually respond within 2 business hours.</p>
                </div>
                
                <form className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Full Name</label>
                      <Input placeholder="John Doe" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Email Address</label>
                      <Input type="email" placeholder="john@example.com" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Subject</label>
                    <Input placeholder="Part Request / Partnership Query" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Message</label>
                    <Textarea placeholder="How can we help you today?" className="min-h-[150px]" />
                  </div>
                  <Button size="lg" className="w-full sm:w-auto px-12 h-12">Submit Inquiry</Button>
                </form>
              </div>

              {/* Contact Info */}
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {[
                    { icon: Phone, label: "Call Us", value: "+254 711 222 333", sub: "Available 24/7 for urgent parts" },
                    { icon: Mail, label: "Email Us", value: "sales@autospare.com", sub: "Standard response: 2h" },
                    { icon: MapPin, label: "Visit Hub", value: "Mombasa Rd, Nairobi", sub: "East Africa Distribution HQ" },
                    { icon: Clock, label: "Working Hours", value: "Mon - Sat", sub: "8:00 AM - 6:00 PM" },
                  ].map((item, idx) => (
                    <Card key={idx} className="border-none bg-secondary/50">
                      <CardContent className="p-8">
                        <item.icon className="h-8 w-8 text-primary mb-4" />
                        <h3 className="font-bold text-xl mb-1">{item.label}</h3>
                        <p className="font-medium">{item.value}</p>
                        <p className="text-sm text-muted-foreground mt-1">{item.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                <div className="h-[300px] bg-secondary rounded-2xl flex items-center justify-center border-2 border-dashed border-muted-foreground/20">
                  <span className="text-muted-foreground font-mono">[Interactive Map Implementation]</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
