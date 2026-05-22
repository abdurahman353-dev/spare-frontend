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
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";

export default function CheckoutPage() {
  const { cart, cartTotal, cartWeight, clearCart } = useCart();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderRefs, setOrderRefs] = useState<string[]>([]);
  const [destinations, setDestinations] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [availableCities, setAvailableCities] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [shippingMethod, setShippingMethod] = useState<"standard" | "express">("standard");
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingDetails, setShippingDetails] = useState({
    firstName: "",
    lastName: "",
    address: "",
    city: "",
    country: "",
    postalCode: "",
    phone: ""
  });
  const router = useRouter();

  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await api.get("/shipping-destinations/active");
        setDestinations(res.data);
        
        const locRes = await api.get("/locations/countries");
        setLocations(locRes.data);
      } catch (err) {
        console.error("Failed to fetch shipping data");
      }
    };
    fetchZones();

    if (!authLoading && !isAuthenticated) {
      router.push("/login?redirect=/checkout");
    }

    // Check for pre-selected shipping destination
    const prefill = localStorage.getItem("spare_prefill_shipping");
    if (prefill) {
      const data = JSON.parse(prefill);
      setShippingDetails(prev => ({
        ...prev,
        firstName: user?.name?.split(' ')[0] || "",
        lastName: user?.name?.split(' ').slice(1).join(' ') || "",
        city: data.city,
        address: data.address
      }));
    } else if (user && (user as any).city) {
      setShippingDetails(prev => ({
        ...prev,
        firstName: user.name.split(' ')[0] || "",
        lastName: user.name.split(' ').slice(1).join(' ') || "",
        city: (user as any).city,
        address: (user as any).address || "",
        country: (user as any).country || ""
      }));
    }
  }, [isAuthenticated, authLoading, router, user]);

  const calculateShippingFeeForCart = (method: "standard" | "express") => {
    if (!shippingDetails.country || !shippingDetails.city || destinations.length === 0) return 0;
    
    let totalFee = 0;
    
    for (const item of cart) {
      // Find matching destination rate:
      // Priority 1: Exact product override for this route/warehouse
      let rate = destinations.find(d => 
        d.country === shippingDetails.country && 
        d.city === shippingDetails.city && 
        d.warehouse_id?.toString() === item.warehouse_id?.toString() &&
        d.product_id?.toString() === item.id?.toString()
      );
      
      // Priority 2: Global route rate (product_id = null) for this warehouse
      if (!rate) {
        rate = destinations.find(d => 
          d.country === shippingDetails.country && 
          d.city === shippingDetails.city && 
          d.warehouse_id?.toString() === item.warehouse_id?.toString() &&
          !d.product_id
        );
      }
      
      // Fallback: If no warehouse match, search by country/city and product/global
      if (!rate) {
        rate = destinations.find(d => 
          d.country === shippingDetails.country && 
          d.city === shippingDetails.city && 
          d.product_id?.toString() === item.id?.toString()
        );
      }
      if (!rate) {
        rate = destinations.find(d => 
          d.country === shippingDetails.country && 
          d.city === shippingDetails.city && 
          !d.product_id
        );
      }
      
      if (rate) {
        const itemWeight = parseFloat((item.weight ?? 1.0).toString());
        const weightRate = parseFloat(rate.weight_rate || 0);
        const baseStandard = parseFloat(rate.standard_fee || 0);
        const distance = parseFloat(rate.distance || 0);
        const distanceRate = parseFloat(rate.distance_rate || 0);
        
        const itemQty = item.quantity || 1;
        const standardFee = weightRate * (itemWeight * itemQty) * distanceRate;
        
        if (method === "express") {
          totalFee += (standardFee * 1.5);
        } else {
          totalFee += standardFee;
        }
      }
    }
    
    return totalFee;
  };

  // Sync available cities and shipping fee when destinations or prefilled city changes
  useEffect(() => {
    if (destinations.length > 0 && shippingDetails.city && !shippingDetails.country) {
      // Try to find the country for the prefilled city
      const zone = destinations.find(d => d.city === shippingDetails.city);
      if (zone) {
        setShippingDetails(prev => ({ ...prev, country: zone.country }));
        setAvailableCities(destinations.filter(d => d.country === zone.country));
        setSelectedZone(zone);
        localStorage.removeItem("spare_prefill_shipping");
      }
    }
  }, [destinations, shippingDetails.city]);

  useEffect(() => {
    if (shippingDetails.country && shippingDetails.city) {
      setShippingFee(calculateShippingFeeForCart(shippingMethod));
    } else {
      setShippingFee(0);
    }
  }, [shippingMethod, shippingDetails.city, shippingDetails.country, cart, destinations]);

  const uniqueCountries = Array.from(new Set(destinations.map(d => d.country)));

  const handleCountryChange = (country: string) => {
    setShippingDetails({ ...shippingDetails, country, city: "" });
    const loc = locations.find(l => l.name === country);
    setAvailableCities(loc ? loc.cities : []);
    setSelectedZone(null);
  };

  const handleCityChange = (city: string) => {
    const zone = destinations.find(d => d.country === shippingDetails.country && d.city === city);
    setShippingDetails({ ...shippingDetails, city });
    setSelectedZone(zone || (destinations.some(d => d.country === shippingDetails.country && d.city === city) ? { country: shippingDetails.country, city } : null));
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      if (step === 1 && !selectedZone) {
        alert("Shipping is currently unavailable for the selected location.");
        return;
      }
      setStep(step + 1);
    } else {
      setIsProcessing(true);
      // Simulate STK Push delay
      setTimeout(async () => {
        try {
          const response = await api.post("/checkout", {
            shipping: {
              first_name: shippingDetails.firstName,
              last_name: shippingDetails.lastName,
              phone: shippingDetails.phone,
              address: shippingDetails.address,
              city: shippingDetails.city,
              country: shippingDetails.country
            },
            items: cart.map(item => ({ 
              id: item.id, 
              quantity: item.quantity, 
              price: item.price,
              warehouse_id: item.warehouse_id 
            })),
            total: cartTotal + shippingFee,
            shipping_fee: shippingFee,
            shipping_method: shippingMethod === 'express' ? 'Express Logistics' : 'Standard Delivery'
          });
          if (response.data.orders && response.data.orders.length > 0) {
            setOrderRefs(response.data.orders.map((o: any) => o.tracking_number));
          } else {
            setOrderRefs([response.data.order?.tracking_number || ""]);
          }
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
          <div className="flex flex-col gap-3 mb-8">
            {orderRefs.map((ref, idx) => (
              <div key={idx} className="bg-white border border-zinc-200 px-6 py-3 rounded-lg shadow-sm">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest text-center">Reference Number</p>
                <p className="text-xl font-black text-zinc-900 tracking-tight text-center">{ref || "Processing..."}</p>
              </div>
            ))}
          </div>
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
                      <SearchableDropdown
                        items={locations.map(loc => ({ id: loc.name, name: loc.name }))}
                        value={shippingDetails.country}
                        onChange={handleCountryChange}
                        placeholder="Select Country"
                        className="h-12 border-zinc-200"
                      />

                      <SearchableDropdown
                        items={availableCities.map((city: any) => ({ id: city.name, name: city.name }))}
                        value={shippingDetails.city}
                        onChange={handleCityChange}
                        placeholder="Select City"
                        disabled={!shippingDetails.country}
                        className="h-12 border-zinc-200"
                      />
                      
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
                        { 
                          id: "standard", 
                          name: "Standard Delivery", 
                          time: "3-5 Business Days", 
                          price: calculateShippingFeeForCart("standard")
                        },
                        { 
                          id: "express", 
                          name: "Express Logistics", 
                          time: "24-48 Hours", 
                          price: calculateShippingFeeForCart("express")
                        },
                      ].map((method) => (
                        <label 
                          key={method.id} 
                          className={cn(
                            "flex items-center justify-between p-6 bg-white rounded-xl border cursor-pointer transition-all",
                            shippingMethod === method.id ? "border-[#0052cc] bg-blue-50/30 ring-1 ring-[#0052cc]" : "hover:border-zinc-300"
                          )}
                        >
                          <div className="flex items-center gap-4">
                            <input 
                              type="radio" 
                              name="shipping" 
                              checked={shippingMethod === method.id} 
                              onChange={() => setShippingMethod(method.id as any)}
                              className="h-5 w-5 text-[#0052cc]" 
                            />
                            <div>
                              <div className="font-bold text-zinc-900">{method.name}</div>
                              <div className="text-sm text-zinc-500 font-medium">{method.time}</div>
                            </div>
                          </div>
                          <div className="font-black text-zinc-900">Ksh {method.price.toLocaleString()}</div>
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
                      <div key={`${item.id}-${item.warehouse_id}`} className="flex justify-between items-start gap-4">
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
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-zinc-500 font-medium">Total Weight</span>
                        <span className="text-white font-bold">{cartWeight.toFixed(2)} KG</span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Subtotal</span>
                        <span className="text-white font-bold">Ksh {cartTotal.toLocaleString()}</span>
                      </div>
                    <div className="flex justify-between text-zinc-400">
                      <span>Shipping ({shippingDetails.city || "Not Selected"})</span>
                      <span className="text-white font-bold">
                        {shippingMethod === "express" ? "Express: " : "Std: "}
                        Ksh {shippingFee.toLocaleString()}
                      </span>
                    </div>
                    <div className="border-t border-white/20 pt-4 flex justify-between items-center">
                      <span className="text-lg font-bold">Total</span>
                      <span className="text-2xl font-black text-primary tracking-tighter">Ksh {(cartTotal + shippingFee).toLocaleString()}</span>
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
