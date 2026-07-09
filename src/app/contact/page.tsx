"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer, formatWorkingHours } from "@/components/layout/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, Clock, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useSettings } from "@/components/providers/SettingsProvider";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import dynamic from "next/dynamic";

const HubMap = dynamic(() => import("@/components/HubMap").then((mod) => mod.HubMap), { ssr: false });

export default function ContactPage() {
  const { settings } = useSettings();
  
  const phone = settings.contact_phone || "";
  const email = settings.contact_email || "";
  const address = settings.physical_address || "";
  const workingHours = settings.working_hours || "";

  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.subject || !form.message) {
      setError("Please fill in all the required fields.");
      return;
    }
    
    try {
      setSending(true);
      setError("");
      await api.post(API_ENDPOINTS.contact.inquiry, form);
      setSuccess(true);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      console.error(err);
      setError("Failed to submit inquiry. Please check your network and try again.");
    } finally {
      setSending(false);
    }
  };

  const contactItems = [
    phone ? { icon: Phone, label: "Call Us", value: phone, sub: "Available 24/7 for urgent parts" } : null,
    email ? { icon: Mail, label: "Email Us", value: email, sub: "Standard response: 2h" } : null,
    address ? { icon: MapPin, label: "Visit Hub", value: address, sub: "East Africa Distribution HQ" } : null,
    workingHours ? { icon: Clock, label: "Working Hours", value: workingHours, sub: "Regional support schedule" } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

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
                
                {success && (
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Inquiry Sent Successfully!</p>
                      <p className="text-sm text-emerald-700 mt-0.5">Thank you for reaching out. The administration team has been notified and will review your quote/message immediately.</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3 shadow-sm animate-in fade-in duration-300">
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Submission Error</p>
                      <p className="text-sm text-red-700 mt-0.5">{error}</p>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">Full Name</label>
                      <Input 
                        value={form.name} 
                        onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="John Doe" 
                        required
                        className="h-12 rounded-lg border-zinc-200 focus:ring-primary focus:border-primary"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-zinc-700">Email Address</label>
                      <Input 
                        type="email" 
                        value={form.email} 
                        onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john@example.com" 
                        required
                        className="h-12 rounded-lg border-zinc-200 focus:ring-primary focus:border-primary"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Subject</label>
                    <Input 
                      value={form.subject} 
                      onChange={(e) => setForm(prev => ({ ...prev, subject: e.target.value }))}
                      placeholder="Part Request / Partnership Query" 
                      required
                      className="h-12 rounded-lg border-zinc-200 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-700">Message / Quote Details</label>
                    <Textarea 
                      value={form.message} 
                      onChange={(e) => setForm(prev => ({ ...prev, message: e.target.value }))}
                      placeholder="Provide part numbers, chassis details, or partnership inquiries here..." 
                      required
                      className="min-h-[150px] rounded-lg border-zinc-200 focus:ring-primary focus:border-primary"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={sending}
                    size="lg" 
                    className="w-full sm:w-auto px-12 h-12 bg-primary hover:bg-primary/90 text-white font-bold rounded-lg shadow-md cursor-pointer"
                  >
                    {sending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Inquiry"
                    )}
                  </Button>
                </form>
              </div>

              {/* Contact Info & Map */}
              <div className="space-y-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {contactItems.map((item, idx) => (
                    <Card key={idx} className="border-none bg-secondary/50 shadow-sm rounded-xl overflow-hidden hover:bg-secondary/70 transition-all duration-300">
                      <CardContent className="p-8">
                        <item.icon className="h-8 w-8 text-primary mb-4" />
                        <h3 className="font-bold text-xl mb-1 text-zinc-900">{item.label}</h3>
                        {item.label === "Call Us" ? (
                          <a href={`tel:${item.value}`} className="font-semibold text-[#0052cc] hover:underline break-all block">
                            {item.value}
                          </a>
                        ) : item.label === "Email Us" ? (
                          <a href={`mailto:${item.value}`} className="font-semibold text-[#0052cc] hover:underline break-all block">
                            {item.value}
                          </a>
                        ) : (
                          <p className="font-medium text-zinc-700 break-all whitespace-pre-line">
                            {item.label === "Working Hours" ? formatWorkingHours(item.value) : item.value}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">{item.sub}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                
                {/* Interactive Leaflet Map */}
                <div className="h-[300px] w-full rounded-2xl overflow-hidden shadow-lg border border-zinc-200 bg-white">
                  <HubMap />
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
