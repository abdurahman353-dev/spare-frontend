"use client";

import { useEffect, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Truck, CreditCard, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export default function CheckoutPage() {
  const { cart, cartTotal, clearCart } = useCart();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [shippingDetails, setShippingDetails] = useState({
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    country: "Kenya",
    postalCode: "",
    phone: ""
  });
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login?redirect=/checkout");
    }

    // Check for pre-selected shipping destination
    const prefill = localStorage.getItem("spare_prefill_shipping");
    if (prefill) {
      const data = JSON.parse(prefill);
      setShippingDetails(prev => ({
        ...prev,
        city: data.city,
        address: data.address
      }));
      // Remove it after pre-filling to keep it fresh
      localStorage.removeItem("spare_prefill_shipping");
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep(step + 1);
    } else {
      setIsProcessing(true);
      // Simulate STK Push delay
      setTimeout(async () => {
        try {
          await api.post("/checkout", {
            shipping: {
              first_name: shippingDetails.firstName,
              last_name: shippingDetails.lastName,
              phone: shippingDetails.phone,
              address: shippingDetails.address,
              city: shippingDetails.city
            },
            items: cart.map(item => ({ 
              id: item.id, 
              quantity: item.quantity, 
              price: item.price,
              warehouse_id: item.warehouse_id 
            })),
            total: cartTotal
          });
          setCompleted(true);
          clearCart();
        } catch (error) {
          console.error("Checkout failed:", error);
          alert("Payment failed or order could not be placed. Please try again.");
        } finally {
          setIsProcessing(false);
        }
      }, 2500);
    }
  };

  if (completed) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-green-50 text-green-600 p-12 rounded-full mb-8"
          >
            <CheckCircle2 className="h-16 w-16" />
          </motion.div>
          <h1 className="text-4xl font-black tracking-tighter mb-4 uppercase">Order Confirmed!</h1>
          <p className="text-muted-foreground mb-8 text-center max-w-md text-lg">
            Thank you for choosing AutoSpare East Africa. Your order has been received and is being processed for rapid dispatch.
          </p>
          <div className="flex gap-4">
            <Link 
              href="/" 
              className={cn(buttonVariants({ variant: "outline" }), "h-14 px-8 font-bold rounded-sm")}
            >
              BACK TO HOME
            </Link>
            <Button onClick={() => router.push('/account?tab=orders')} className="h-14 px-8 font-bold rounded-sm bg-zinc-950 text-white">
              TRACK SHIPMENT
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50 font-sans">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col lg:flex-row gap-12">
            
            {/* Checkout Steps */}
            <div className="flex-1 space-y-8">
              <div className="flex items-center gap-4 mb-8">
                <h1 className="text-4xl font-black tracking-tighter uppercase">Checkout</h1>
                <div className="h-px bg-zinc-200 flex-1" />
              </div>

              <div className="flex gap-2 mb-8">
                {[1, 2, 3].map((s) => (
                  <div 
                    key={s} 
                    className={`h-2 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-zinc-200"} transition-colors`}
                  />
                ))}
              </div>

              <form onSubmit={handleCheckout} className="space-y-8">
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h2 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
                      <Truck className="h-6 w-6 text-primary" /> 1. Shipping Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input placeholder="First Name" required className="h-12 bg-white" value={shippingDetails.firstName} onChange={(e) => setShippingDetails({...shippingDetails, firstName: e.target.value})} />
                      <Input placeholder="Last Name" required className="h-12 bg-white" value={shippingDetails.lastName} onChange={(e) => setShippingDetails({...shippingDetails, lastName: e.target.value})} />
                    </div>
                    <Input placeholder="Address Line 1" required className="h-12 bg-white" value={shippingDetails.address} onChange={(e) => setShippingDetails({...shippingDetails, address: e.target.value})} />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <Input placeholder="City" required className="h-12 bg-white" value={shippingDetails.city} onChange={(e) => setShippingDetails({...shippingDetails, city: e.target.value})} />
                      <Input placeholder="Country (e.g., Kenya)" required className="h-12 bg-white" value={shippingDetails.country} onChange={(e) => setShippingDetails({...shippingDetails, country: e.target.value})} />
                      <Input placeholder="Postal Code" required className="h-12 bg-white" value={shippingDetails.postalCode} onChange={(e) => setShippingDetails({...shippingDetails, postalCode: e.target.value})} />
                    </div>
                    <Button type="submit" className="h-14 px-10 font-bold rounded-sm">
                      CONTINUE TO SHIPPING <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h2 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
                      <Truck className="h-6 w-6 text-primary" /> 2. Shipping Method
                    </h2>
                    <div className="space-y-4">
                      {[
                        { name: "Standard Delivery", time: "3-5 Business Days", price: "Ksh 0.00" },
                        { name: "Express Logistics", time: "24-48 Hours", price: "Ksh 2,500.00" },
                      ].map((method, idx) => (
                        <label key={idx} className="flex items-center justify-between p-6 bg-white rounded-xl border cursor-pointer hover:border-primary transition-colors">
                          <div className="flex items-center gap-4">
                            <input type="radio" name="shipping" defaultChecked={idx === 0} className="h-5 w-5 text-primary" />
                            <div>
                              <div className="font-bold">{method.name}</div>
                              <div className="text-sm text-muted-foreground">{method.time}</div>
                            </div>
                          </div>
                          <div className="font-black">{method.price}</div>
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-4">
                      <Button type="button" variant="outline" onClick={() => setStep(1)} className="h-14 px-10 font-bold rounded-sm">BACK</Button>
                      <Button type="submit" className="h-14 px-10 font-bold rounded-sm flex-1">CONTINUE TO PAYMENT <ArrowRight className="ml-2 h-5 w-5" /></Button>
                    </div>
                  </motion.div>
                )}

                {step === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h2 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
                      <CreditCard className="h-6 w-6 text-primary" /> 3. Payment Method
                    </h2>
                    <div className="bg-white p-8 rounded-xl border space-y-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="h-12 w-20 bg-green-500 rounded flex items-center justify-center text-white font-black italic tracking-tighter text-xl">
                          M-PESA
                        </div>
                        <p className="text-sm font-semibold text-zinc-500">Pay securely via STK Push</p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-zinc-500">M-Pesa Phone Number</label>
                        <Input 
                          placeholder="e.g. 0712 345 678 or 2547..." 
                          required 
                          className="h-12 bg-zinc-50 font-semibold" 
                          value={shippingDetails.phone}
                          onChange={(e) => setShippingDetails({...shippingDetails, phone: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <Button type="button" variant="outline" onClick={() => setStep(2)} className="h-14 px-10 font-bold rounded-sm">BACK</Button>
                      <Button type="submit" disabled={isProcessing} className="h-14 px-10 font-black rounded-sm flex-1 bg-green-600 hover:bg-green-700 text-white shadow-xl shadow-green-600/20">
                        {isProcessing ? (
                          <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> WAITING FOR PIN...</>
                        ) : (
                          "INITIATE STK PUSH"
                        )}
                      </Button>
                    </div>
                  </motion.div>
                )}
              </form>
            </div>

            {/* Order Summary */}
            <div className="w-full lg:w-96">
              <Card className="bg-zinc-900 text-white border-none shadow-2xl rounded-2xl overflow-hidden sticky top-24">
                <CardContent className="p-8 space-y-6">
                  <h3 className="text-xl font-black uppercase tracking-tighter border-b border-white/10 pb-4">In Your Order</h3>
                  <div className="max-h-[300px] overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {cart.map((item) => (
                      <div key={item.id} className="flex justify-between items-start gap-4">
                        <div className="flex-1">
                          <div className="text-xs font-bold text-primary uppercase">{item.brand.name}</div>
                          <div className="font-bold line-clamp-1">{item.name}</div>
                          <div className="text-xs text-zinc-500">Qty: {item.quantity} • {item.warehouse_name}</div>
                        </div>
                        <div className="font-bold">Ksh {(item.price * item.quantity).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                  
                  <div className="border-t border-white/10 pt-6 space-y-3">
                    <div className="flex justify-between text-zinc-400">
                      <span>Subtotal</span>
                      <span className="text-white font-bold">Ksh {cartTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Shipping</span>
                      <span className="text-white font-bold">Ksh 0.00</span>
                    </div>
                    <div className="border-t border-white/20 pt-4 flex justify-between items-center">
                      <span className="text-lg font-bold">Total</span>
                      <span className="text-2xl font-black text-primary tracking-tighter">Ksh {cartTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="bg-white/5 p-4 rounded-lg flex items-center gap-3">
                    <ShieldCheck className="h-6 w-6 text-primary shrink-0" />
                    <div className="text-[10px] text-zinc-400 leading-tight uppercase font-bold">
                      Your transaction is encrypted with 256-bit SSL security and certified by AutoSpare.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
