"use client";

import { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  ShieldCheck, Truck, CreditCard, ArrowRight, CheckCircle2,
  Loader2, Smartphone, AlertCircle, RefreshCw, Building2, Copy, Check,
  ShoppingBag
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import { useSettings } from "@/components/providers/SettingsProvider";
import {
  isValidKenyanPhone,
  validateShippingForm,
  validatePaymentPhone,
  sanitizeText,
} from "@/lib/validation";

type PaymentMethod = "mpesa_stk" | "paybill";
type PaymentStatus = "idle" | "pending" | "paybill_verify" | "success" | "failed" | "timeout";

export default function CheckoutPage() {
  const { cart, cartTotal, cartWeight, clearCart } = useCart();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { settings } = useSettings();
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderRefs, setOrderRefs] = useState<string[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Shipping
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

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("mpesa_stk");
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>("idle");
  const [paymentError, setPaymentError] = useState("");
  const [paybillOrderId, setPaybillOrderId] = useState<number | null>(null);
  const [mpesaCode, setMpesaCode] = useState("");
  const [mpesaCodeError, setMpesaCodeError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

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

    // Pre-fill phone from user profile
    if (user) {
      setMpesaPhone((user as any).phone || "");
    }
  }, [isAuthenticated, authLoading, router, user]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  const calculateShippingFeeForCart = (method: "standard" | "express") => {
    if (!shippingDetails.country || !shippingDetails.city || destinations.length === 0) return 0;
    let totalFee = 0;
    for (const item of cart) {
      let rate = destinations.find(d =>
        d.country === shippingDetails.country &&
        d.city === shippingDetails.city &&
        d.warehouse_id?.toString() === item.warehouse_id?.toString() &&
        d.product_id?.toString() === item.id?.toString()
      );
      if (!rate) {
        rate = destinations.find(d =>
          d.country === shippingDetails.country &&
          d.city === shippingDetails.city &&
          d.warehouse_id?.toString() === item.warehouse_id?.toString() &&
          !d.product_id
        );
      }
      if (!rate) {
        rate = destinations.find(d =>
          d.country === shippingDetails.country &&
          d.city === shippingDetails.city &&
          d.product_id?.toString() === item.id?.toString() &&
          !d.warehouse_id
        );
      }
      if (rate) {
        const feePerItem = method === "express"
          ? parseFloat(rate.express_fee || 0)
          : parseFloat(rate.standard_fee || 0);
        totalFee += feePerItem * (item.quantity || 1);
      }
    }
    return totalFee;
  };

  const getItemShippingFee = (item: any, method: "standard" | "express"): number => {
    let rate = destinations.find(d =>
      d.country === shippingDetails.country &&
      d.city === shippingDetails.city &&
      d.warehouse_id?.toString() === item.warehouse_id?.toString() &&
      d.product_id?.toString() === item.id?.toString()
    );
    if (!rate) {
      rate = destinations.find(d =>
        d.country === shippingDetails.country &&
        d.city === shippingDetails.city &&
        d.warehouse_id?.toString() === item.warehouse_id?.toString() &&
        !d.product_id
      );
    }
    if (!rate) {
      rate = destinations.find(d =>
        d.country === shippingDetails.country &&
        d.city === shippingDetails.city &&
        d.product_id?.toString() === item.id?.toString() &&
        !d.warehouse_id
      );
    }
    if (!rate) return 0;
    const feePerItem = method === "express"
      ? parseFloat(rate.express_fee || 0)
      : parseFloat(rate.standard_fee || 0);
    return feePerItem * (item.quantity || 1);
  };

  useEffect(() => {
    if (destinations.length > 0 && shippingDetails.city && !shippingDetails.country) {
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

  // ── Polling for STK Push result ──────────────────────────────────────────────
  const startPolling = (reqId: string) => {
    let attempts = 0;
    const maxAttempts = 24; // 24 × 5s = 2 minutes

    setCountdown(120);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(countdownIntervalRef.current!);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await api.post("/mpesa/query", { checkout_request_id: reqId });
        const { status } = res.data;

        if (status === "success") {
          clearInterval(pollIntervalRef.current!);
          clearInterval(countdownIntervalRef.current!);
          setPaymentStatus("success");
          setCompleted(true);
          clearCart();
        } else if (status === "failed" || status === "cancelled") {
          clearInterval(pollIntervalRef.current!);
          clearInterval(countdownIntervalRef.current!);
          setPaymentStatus("failed");
          setPaymentError("Payment was declined or cancelled. Please try again.");
          setIsProcessing(false);
        }
      } catch {
        // Network error during poll — keep trying
      }

      if (attempts >= maxAttempts) {
        clearInterval(pollIntervalRef.current!);
        clearInterval(countdownIntervalRef.current!);
        setPaymentStatus("timeout");
        setPaymentError("Payment timed out. If you completed the payment, check your orders page.");
        setIsProcessing(false);
      }
    }, 5000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // ── Checkout form submission ──────────────────────────────────────────────────
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();

    if (step < 3) {
      if (step === 1) {
        // Validate shipping form
        const errors = validateShippingForm({
          firstName: shippingDetails.firstName,
          lastName: shippingDetails.lastName,
          address: shippingDetails.address,
          city: shippingDetails.city,
          country: shippingDetails.country,
          postalCode: shippingDetails.postalCode,
          phone: shippingDetails.phone,
        });
        if (Object.keys(errors).length > 0) {
          setFormErrors(errors);
          return;
        }
        if (!selectedZone) {
          alert("Shipping is currently unavailable for the selected location.");
          return;
        }
        setFormErrors({});
      }
      setStep(step + 1);
      return;
    }

    // Step 3 — payment
    if (paymentMethod === "mpesa_stk") {
      const phoneErr = validatePaymentPhone(mpesaPhone);
      if (phoneErr) {
        setPhoneError(phoneErr);
        return;
      }
      setPhoneError("");
    }

    setIsProcessing(true);
    setPaymentStatus("pending");
    setPaymentError("");

    try {
      // 1. Create orders (Pending payment)
      const checkoutResponse = await api.post("/checkout", {
        shipping: {
          first_name: sanitizeText(shippingDetails.firstName),
          last_name: sanitizeText(shippingDetails.lastName),
          phone: shippingDetails.phone,
          address: sanitizeText(shippingDetails.address),
          city: shippingDetails.city,
          country: shippingDetails.country
        },
        items: cart.map(item => ({
          id: item.id,
          quantity: item.quantity,
          price: item.price,
          warehouse_id: item.warehouse_id,
          shipping_fee: getItemShippingFee(item, shippingMethod)
        })),
        total: cartTotal + shippingFee,
        shipping_fee: shippingFee,
        shipping_method: shippingMethod === "express" ? "Express Logistics" : "Standard Delivery"
      });

      const orderIds: number[] = checkoutResponse.data.order_ids || [];
      const totalAmount: number = checkoutResponse.data.total_amount || (cartTotal + shippingFee);
      const refs: string[] = (checkoutResponse.data.orders || []).map((o: any) => o.tracking_number);
      setOrderRefs(refs.length > 0 ? refs : [checkoutResponse.data.order?.tracking_number || ""]);

      if (paymentMethod === "paybill") {
        // Change to verification step
        setPaymentStatus("paybill_verify");
        setPaybillOrderId(orderIds[0]);
        setIsProcessing(false);

        // Start polling order status for auto-confirmation
        pollIntervalRef.current = setInterval(async () => {
          try {
            const res = await api.get(`/orders/${orderIds[0]}`);
            if (res.data.payment_status === "Paid") {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
              setPaymentStatus("success");
              setCompleted(true);
              clearCart();
            }
          } catch { }
        }, 5000);
        return;
      }

      // 2. Initiate STK Push
      const stkResponse = await api.post("/mpesa/stk-push", {
        phone: mpesaPhone,
        amount: totalAmount,
        order_ids: orderIds,
      });

      const reqId: string = stkResponse.data.checkout_request_id;
      setCheckoutRequestId(reqId);

      // 3. Start polling for confirmation
      if (reqId) {
        startPolling(reqId);
      } else {
        // No checkout_request_id — sandbox or error
        setPaymentStatus("failed");
        setPaymentError(stkResponse.data.message || "Could not initiate payment.");
        setIsProcessing(false);
      }
    } catch (error: any) {
      console.error("Checkout failed:", error);
      const msg = error?.response?.data?.message || "Payment failed or order could not be placed. Please try again.";
      setPaymentError(msg);
      setPaymentStatus("failed");
      setIsProcessing(false);
    }
  };

  const handleRetry = () => {
    setPaymentStatus("idle");
    setPaymentError("");
    setMpesaCodeError("");
    setCheckoutRequestId(null);
    setIsProcessing(false);
    setCountdown(0);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const handleVerifyMpesaCode = async () => {
    if (!mpesaCode.trim()) {
      setMpesaCodeError("Please enter the M-Pesa transaction code.");
      return;
    }

    setIsVerifying(true);
    setMpesaCodeError("");
    try {
      await api.post(`/orders/${paybillOrderId}/verify-mpesa-code`, { mpesa_code: mpesaCode });
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setPaymentStatus("success");
      setCompleted(true);
      clearCart();
    } catch (err: any) {
      setMpesaCodeError(err.response?.data?.message || "Verification failed. Ensure you completed the payment.");
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Paybill number from settings or fallback ─────────────────────────────────
  const paybillNumber = (settings as any)?.mpesa_paybill_number || "400200";

  // ── Empty Cart protection ────────────────────────────────────────────────────
  if (mounted && cart.length === 0 && !completed) {
    return (
      <div className="flex flex-col min-h-screen bg-white">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="bg-[#f8fafc] border border-zinc-200 p-12 rounded-full mb-8 shadow-sm animate-bounce">
            <ShoppingBag className="h-16 w-16 text-zinc-400" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter mb-4 uppercase text-[#1e293b]">YOUR CART IS EMPTY</h1>
          <p className="text-[#64748b] mb-8 text-center max-w-md text-[15px] leading-relaxed">
            You cannot proceed to checkout with an empty cart. Please add some genuine parts to your selection first.
          </p>
          <Link 
            href="/products" 
            className={cn(buttonVariants({ size: "lg" }), "h-14 px-10 font-bold rounded-sm bg-[#0052cc] text-white hover:bg-[#0747a6] transition-colors")}
          >
            GO TO CATALOG
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  // ── Success screen ────────────────────────────────────────────────────────────
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
          {paymentMethod === "paybill" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 border border-amber-200 rounded-xl p-6 mb-6 max-w-md w-full"
            >
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-5 w-5 text-amber-600" />
                <p className="font-bold text-amber-800">Complete Your Payment via Paybill</p>
              </div>
              <p className="text-sm text-amber-700 mb-3">
                Your order is reserved. Please complete payment within 24 hours using:
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center bg-white rounded-lg px-4 py-2 border border-amber-200">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Paybill No.</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-zinc-900">{paybillNumber}</span>
                    <button onClick={() => copyToClipboard(paybillNumber, "paybill")} className="text-zinc-400 hover:text-zinc-700">
                      {copied === "paybill" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex justify-between items-center bg-white rounded-lg px-4 py-2 border border-amber-200">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Account No.</span>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-zinc-900">{orderRefs[0] || "See order"}</span>
                    <button onClick={() => copyToClipboard(orderRefs[0] || "", "acc")} className="text-zinc-400 hover:text-zinc-700">
                      {copied === "acc" ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
          <p className="text-muted-foreground mb-8 text-center max-w-md text-lg">
            Thank you for choosing {settings?.store_name || "AutoSpare East Africa"}. Your order has been received and is being processed.
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

              {/* Step indicator */}
              <div className="flex gap-2 mb-8">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-zinc-200"} transition-colors`}
                  />
                ))}
              </div>

              <form onSubmit={handleCheckout} className="space-y-8">
                {/* ── Step 1: Shipping Details ── */}
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h2 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
                      <Truck className="h-6 w-6 text-primary" /> 1. Shipping Details
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Input
                          id="firstName"
                          placeholder="First Name"
                          required
                          className={cn("h-12 bg-white", formErrors.firstName && "border-red-500")}
                          value={shippingDetails.firstName}
                          onChange={(e) => setShippingDetails({ ...shippingDetails, firstName: e.target.value })}
                        />
                        {formErrors.firstName && <p className="text-xs text-red-500">{formErrors.firstName}</p>}
                      </div>
                      <div className="space-y-1">
                        <Input
                          id="lastName"
                          placeholder="Last Name"
                          required
                          className={cn("h-12 bg-white", formErrors.lastName && "border-red-500")}
                          value={shippingDetails.lastName}
                          onChange={(e) => setShippingDetails({ ...shippingDetails, lastName: e.target.value })}
                        />
                        {formErrors.lastName && <p className="text-xs text-red-500">{formErrors.lastName}</p>}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Input
                        id="address"
                        placeholder="Address Line 1"
                        required
                        className={cn("h-12 bg-white", formErrors.address && "border-red-500")}
                        value={shippingDetails.address}
                        onChange={(e) => setShippingDetails({ ...shippingDetails, address: e.target.value })}
                      />
                      {formErrors.address && <p className="text-xs text-red-500">{formErrors.address}</p>}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <SearchableDropdown
                          items={locations.map(loc => ({ id: loc.name, name: loc.name }))}
                          value={shippingDetails.country}
                          onChange={handleCountryChange}
                          placeholder="Select Country"
                          className={cn("h-12 border-zinc-200", formErrors.country && "border-red-500")}
                        />
                        {formErrors.country && <p className="text-xs text-red-500">{formErrors.country}</p>}
                      </div>
                      <div className="space-y-1">
                        <SearchableDropdown
                          items={availableCities.map((city: any) => ({ id: city.name, name: city.name }))}
                          value={shippingDetails.city}
                          onChange={handleCityChange}
                          placeholder="Select City"
                          disabled={!shippingDetails.country}
                          className={cn("h-12 border-zinc-200", formErrors.city && "border-red-500")}
                        />
                        {formErrors.city && <p className="text-xs text-red-500">{formErrors.city}</p>}
                      </div>
                      <Input
                        id="postalCode"
                        placeholder="Postal Code"
                        className="h-12 bg-white"
                        value={shippingDetails.postalCode}
                        onChange={(e) => setShippingDetails({ ...shippingDetails, postalCode: e.target.value })}
                      />
                    </div>
                    <Button type="submit" className="h-14 px-10 font-bold rounded-sm">
                      CONTINUE TO SHIPPING <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </motion.div>
                )}

                {/* ── Step 2: Shipping Method ── */}
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

                {/* ── Step 3: Payment ── */}
                {step === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h2 className="text-2xl font-black flex items-center gap-3 uppercase tracking-tighter">
                      <CreditCard className="h-6 w-6 text-primary" /> 3. Payment
                    </h2>

                    {/* Payment method tabs */}
                    <div className="flex gap-2 bg-zinc-100 p-1 rounded-xl">
                      <button
                        type="button"
                        id="tab-mpesa-stk"
                        onClick={() => { setPaymentMethod("mpesa_stk"); handleRetry(); }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold transition-all",
                          paymentMethod === "mpesa_stk"
                            ? "bg-white shadow text-green-700 border border-green-200"
                            : "text-zinc-500 hover:text-zinc-700"
                        )}
                      >
                        <Smartphone className="h-4 w-4" />
                        STK Push (Instant)
                      </button>
                      {/* <button
                        type="button"
                        id="tab-paybill"
                        onClick={() => { setPaymentMethod("paybill"); handleRetry(); }}
                        className={cn(
                          "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-bold transition-all",
                          paymentMethod === "paybill"
                            ? "bg-white shadow text-zinc-800 border border-zinc-200"
                            : "text-zinc-500 hover:text-zinc-700"
                        )}
                      >
                        <Building2 className="h-4 w-4" />
                        Pay via Paybill
                      </button> */}
                    </div>

                    <AnimatePresence mode="wait">
                      {/* ── M-Pesa STK Push panel ── */}
                      {paymentMethod === "mpesa_stk" && (
                        <motion.div
                          key="stk"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-white p-8 rounded-xl border space-y-6"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-20 bg-green-500 rounded flex items-center justify-center text-white font-black italic tracking-tighter text-xl">
                              M-PESA
                            </div>
                            <div>
                              <p className="font-bold text-zinc-800">M-Pesa STK Push</p>
                              <p className="text-sm text-zinc-500">We'll send a payment prompt directly to your phone</p>
                            </div>
                          </div>

                          {/* Phone input */}
                          <div className="space-y-2">
                            <label htmlFor="mpesa-phone" className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                              M-Pesa Phone Number
                            </label>
                            <Input
                              id="mpesa-phone"
                              placeholder="e.g. 0712 345 678"
                              required={paymentMethod === "mpesa_stk"}
                              className={cn("h-12 bg-zinc-50 font-semibold", phoneError && "border-red-500")}
                              value={mpesaPhone}
                              onChange={(e) => {
                                setMpesaPhone(e.target.value);
                                if (phoneError) setPhoneError("");
                              }}
                            />
                            {phoneError && (
                              <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {phoneError}
                              </p>
                            )}
                          </div>

                          {/* Pending: waiting for PIN */}
                          {paymentStatus === "pending" && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              className="bg-green-50 border border-green-200 rounded-xl p-6 text-center space-y-3"
                            >
                              <div className="flex justify-center">
                                <div className="relative">
                                  <Loader2 className="h-10 w-10 text-green-600 animate-spin" />
                                  <Smartphone className="h-4 w-4 text-green-800 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                                </div>
                              </div>
                              <p className="font-bold text-green-800 text-lg">Check Your Phone!</p>
                              <p className="text-sm text-green-700">
                                A payment request has been sent to <span className="font-bold">{mpesaPhone}</span>.
                                Enter your M-Pesa PIN to complete payment.
                              </p>
                              {countdown > 0 && (
                                <p className="text-xs text-green-600 font-medium">
                                  Waiting for confirmation... {countdown}s
                                </p>
                              )}
                            </motion.div>
                          )}

                          {/* Failed / timeout */}
                          {(paymentStatus === "failed" || paymentStatus === "timeout") && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3"
                            >
                              <div className="flex items-center gap-2 text-red-700">
                                <AlertCircle className="h-5 w-5 shrink-0" />
                                <p className="font-bold">{paymentStatus === "timeout" ? "Payment Timed Out" : "Payment Failed"}</p>
                              </div>
                              <p className="text-sm text-red-600">{paymentError}</p>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleRetry}
                                className="flex items-center gap-2 border-red-300 text-red-700 hover:bg-red-50"
                              >
                                <RefreshCw className="h-4 w-4" /> Try Again
                              </Button>
                            </motion.div>
                          )}

                          {/* How it works */}
                          <div className="bg-zinc-50 rounded-lg p-4 space-y-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">How it works</p>
                            <ol className="space-y-1">
                              {[
                                "Enter your M-Pesa registered phone number",
                                "Click \"Initiate Payment\"",
                                "A prompt appears on your phone — enter your M-Pesa PIN",
                                "Payment is confirmed instantly"
                              ].map((step, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-zinc-600">
                                  <span className="bg-green-100 text-green-700 text-xs font-black rounded-full h-5 w-5 flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        </motion.div>
                      )}

                      {/* ── Paybill Panel ── */}
                      {paymentMethod === "paybill" && (
                        <motion.div
                          key="paybill"
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="bg-white p-8 rounded-xl border space-y-6"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-20 bg-zinc-800 rounded flex items-center justify-center text-white font-black italic tracking-tighter text-xl">
                              M-PESA
                            </div>
                            <div>
                              <p className="font-bold text-zinc-800">Lipa na M-Pesa — Paybill</p>
                              <p className="text-sm text-zinc-500">Pay manually using our M-Pesa Paybill number</p>
                            </div>
                          </div>

                          {/* Paybill details */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-zinc-50 border rounded-xl p-4 space-y-1">
                              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Business No.</p>
                              <p className="text-2xl font-black text-zinc-900">{paybillNumber}</p>
                            </div>
                            <div className="bg-zinc-50 border rounded-xl p-4 space-y-1">
                              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Amount (KSH)</p>
                              <p className="text-2xl font-black text-zinc-900">{(cartTotal + shippingFee).toLocaleString()}</p>
                            </div>
                          </div>

                          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 space-y-1">
                            <p className="text-xs font-bold uppercase tracking-widest text-amber-600">Account Number</p>
                            <p className="text-sm text-amber-800 font-medium">
                              {paymentStatus === "paybill_verify"
                                ? "Use the Account No shown above exactly as it appears when paying."
                                : 'Use your order tracking number as the account number. It will be shown after you click "Place Order".'
                              }
                            </p>
                          </div>

                          {/* Step-by-step instructions */}
                          <div className="space-y-2">
                            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">How to Pay via Paybill</p>
                            <ol className="space-y-3">
                              {[
                                "Go to your M-Pesa menu on your phone",
                                "Select \"Lipa na M-Pesa\"",
                                "Select \"Pay Bill\"",
                                `Enter Business No: ${paybillNumber}`,
                                "Enter Account No: [your order tracking number]",
                                `Enter Amount: KSH ${(cartTotal + shippingFee).toLocaleString()}`,
                                "Enter your M-Pesa PIN and confirm",
                                "Your order will be confirmed once payment is received (within 1-2 hours)"
                              ].map((instruction, i) => (
                                <li key={i} className="flex items-start gap-3 text-sm text-zinc-700">
                                  <span className="bg-zinc-900 text-white text-xs font-black rounded-full h-6 w-6 flex items-center justify-center shrink-0 mt-0.5">
                                    {i + 1}
                                  </span>
                                  <span>{instruction}</span>
                                </li>
                              ))}
                            </ol>
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                            ✅ Your order will be reserved for <strong>24 hours</strong>. Please complete payment within this time to avoid cancellation.
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action buttons */}
                    <div className="flex gap-4">
                      {paymentStatus !== "paybill_verify" && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setStep(2)}
                          disabled={isProcessing && paymentStatus === "pending"}
                          className="h-14 px-10 font-bold rounded-sm"
                        >
                          BACK
                        </Button>
                      )}
                      {paymentStatus !== "pending" && paymentStatus !== "paybill_verify" && (
                        <Button
                          type="submit"
                          disabled={isProcessing}
                          id="initiate-payment-btn"
                          className={cn(
                            "h-14 px-10 font-black rounded-sm flex-1 shadow-xl text-white",
                            paymentMethod === "mpesa_stk"
                              ? "bg-green-600 hover:bg-green-700 shadow-green-600/20"
                              : "bg-zinc-900 hover:bg-zinc-800 shadow-zinc-900/20"
                          )}
                        >
                          {isProcessing ? (
                            <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...</>
                          ) : paymentMethod === "mpesa_stk" ? (
                            <><Smartphone className="mr-2 h-5 w-5" /> INITIATE PAYMENT</>
                          ) : (
                            <><Building2 className="mr-2 h-5 w-5" /> PLACE ORDER</>
                          )}
                        </Button>
                      )}
                    </div>

                    {paymentStatus === "paybill_verify" && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-6 bg-zinc-100 rounded-xl space-y-4 border border-zinc-200 shadow-inner">
                        <div className="flex items-center gap-2 text-zinc-800">
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                          <p className="text-sm font-bold">Order placed! Next, verify your payment.</p>
                        </div>
                        <div className="flex flex-col gap-3">
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter M-Pesa Code (e.g. RKT...)"
                              value={mpesaCode}
                              onChange={e => {
                                setMpesaCode(e.target.value);
                                setMpesaCodeError("");
                              }}
                              className={cn("h-14 font-black uppercase flex-1 shadow-sm", mpesaCodeError ? "border-red-500" : "border-zinc-300")}
                            />
                            <Button
                              type="button"
                              onClick={handleVerifyMpesaCode}
                              disabled={isVerifying}
                              className="h-14 px-8 font-black shadow-lg"
                            >
                              {isVerifying ? <Loader2 className="animate-spin h-5 w-5" /> : "VERIFY"}
                            </Button>
                          </div>
                          {mpesaCodeError && <p className="text-sm text-red-600 font-bold">{mpesaCodeError}</p>}
                        </div>
                        <div className="flex items-center gap-2 justify-center text-xs text-zinc-500 font-medium pt-2">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          We are also checking automatically for your payment...
                        </div>
                      </motion.div>
                    )}
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
