"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus, ShoppingBag, ArrowRight } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { toast } from "react-hot-toast";

import api from "@/lib/axios";
import { useEffect, useState } from "react";

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, cartTotal } = useCart();
  const [isValidating, setIsValidating] = useState(false);

  // Live stock auto-adjustment on cart page mount
  useEffect(() => {
    const validateLiveCartStock = async () => {
      if (!cart || cart.length === 0) return;
      setIsValidating(true);
      const uniqueProductIds = Array.from(new Set(cart.map((i) => i.id)));

      for (const prodId of uniqueProductIds) {
        try {
          const res = await api.get(`/products/${prodId}`);
          const product = res.data;
          if (!product || !product.inventories) continue;

          const cartItemsForProd = cart.filter((i) => i.id === prodId);
          for (const item of cartItemsForProd) {
            const whInv = product.inventories.find((inv: any) => Number(inv.warehouse_id) === Number(item.warehouse_id));
            const liveStock = whInv ? Number(whInv.quantity) : 0;

            if (liveStock === 0) {
              removeFromCart(item.id, item.warehouse_id);
              toast.error(`"${item.name}" at ${item.warehouse_name} is out of stock and was removed from your cart.`, {
                duration: 6000,
                style: { background: "#ef4444", color: "#fff", fontWeight: "bold", fontSize: "12px" },
              });
            } else if (item.quantity > liveStock) {
              updateQuantity(item.id, item.warehouse_id, liveStock);
              toast.error(`Quantity for "${item.name}" was adjusted to ${liveStock} due to current stock at ${item.warehouse_name}.`, {
                duration: 6000,
                style: { background: "#f59e0b", color: "#fff", fontWeight: "bold", fontSize: "12px" },
              });
            }
          }
        } catch (e) {
          console.error("Failed to revalidate live stock for product", prodId, e);
        }
      }
      setIsValidating(false);
    };

    validateLiveCartStock();
  }, []);

  if (cart.length === 0) {
    return (
      <div className="flex flex-col min-h-screen">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <div className="bg-secondary/50 p-12 rounded-full mb-8">
            <ShoppingBag className="h-16 w-16 text-muted-foreground" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter mb-4">YOUR CART IS EMPTY</h1>
          <p className="text-muted-foreground mb-8 text-center max-w-md">
            Looks like you haven't added any genuine parts to your selection yet. 
            Browse our catalog to find what you need.
          </p>
          <Link 
            href="/products" 
            className={cn(buttonVariants({ size: "lg" }), "h-14 px-10 font-bold rounded-sm bg-blue-600 text-white hover:bg-blue-700 transition-colors")}
          >
            CONTINUE SHOPPING
          </Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-zinc-50">
      <Navbar />
      <main className="flex-1 py-12">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-12">
            <h1 className="text-4xl font-black tracking-tighter uppercase">Shopping Cart</h1>
            <span className="bg-primary text-white text-xs font-black px-3 py-1 rounded-full">{cart.length} ITEMS</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Cart Items List */}
            <div className="lg:col-span-2 space-y-6">
              {cart.map((item) => (
                <motion.div 
                  layout
                  key={`${item.id}-${item.warehouse_id}`} 
                  className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col sm:flex-row items-center gap-6"
                >
                  <div className="h-24 w-24 bg-secondary rounded-xl flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="text-xs font-bold text-primary uppercase tracking-tighter">{item.brand.name}</div>
                    <h3 className="text-xl font-bold">{item.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-muted-foreground font-mono">SKU: {item.sku}</p>
                      <span className="text-[10px] bg-blue-50 text-blue-700 font-black px-2 py-0.5 rounded border border-blue-100 uppercase tracking-tighter">
                        {item.warehouse_name}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center border rounded-lg overflow-hidden bg-zinc-50">
                      <button 
                        onClick={() => {
                          updateQuantity(item.id, item.warehouse_id, item.quantity - 1);
                        }}
                        disabled={item.quantity <= 1}
                        className="p-2 hover:bg-zinc-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="w-12 text-center font-bold">{item.quantity}</span>
                      <button 
                        onClick={() => {
                          updateQuantity(item.id, item.warehouse_id, item.quantity + 1);
                        }}
                        disabled={item.stock_quantity !== undefined && item.quantity >= item.stock_quantity}
                        className="p-2 hover:bg-zinc-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="text-xl font-black w-24 text-right">
                      Ksh {(item.price * item.quantity).toLocaleString()}
                    </div>
                    <button 
                      onClick={() => {
                        removeFromCart(item.id, item.warehouse_id);
                        toast.error(`${item.name} removed from cart`, {
                          style: { background: '#18181b', color: '#fff', fontSize: '12px' },
                          icon: '🗑️'
                        });
                      }}
                      className="p-2 text-zinc-400 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Summary Sidebar */}
            <div className="space-y-6">
              <div className="bg-zinc-900 text-white p-8 rounded-2xl shadow-xl space-y-8">
                <h3 className="text-2xl font-black tracking-tighter border-b border-white/10 pb-4 uppercase">Order Summary</h3>
                
                <div className="space-y-4">
                  <div className="flex justify-between text-zinc-400">
                    <span>Subtotal</span>
                    <span className="text-white font-bold">Ksh {cartTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Shipping</span>
                    <span className="text-white font-bold">Calculated at checkout</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Estimated Tax</span>
                    <span className="text-white font-bold">Ksh 0.00</span>
                  </div>
                </div>

                <div className="border-t border-white/20 pt-6 flex justify-between items-center">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-3xl font-black text-primary tracking-tighter">Ksh {cartTotal.toLocaleString()}</span>
                </div>

                <Link 
                  href="/checkout" 
                  className={cn(buttonVariants(), "w-full h-16 text-lg font-black rounded-sm group shadow-2xl shadow-primary/20 flex items-center justify-center")}
                >
                  PROCEED TO CHECKOUT <ArrowRight className="ml-2 h-6 w-6 group-hover:translate-x-1 transition-transform" />
                </Link>
                
                <p className="text-[10px] text-zinc-500 text-center uppercase tracking-widest font-bold">
                  Secure Enterprise Checkout
                </p>
              </div>
              
              <div className="bg-primary/5 border border-primary/20 p-6 rounded-2xl">
                <h4 className="font-bold mb-2">Need bulk ordering?</h4>
                <p className="text-sm text-zinc-600 mb-4">Distributors can get specialized pricing via the partner portal.</p>
                <Link href="/login" className="text-sm font-black text-primary hover:underline uppercase tracking-tighter">Login as Partner</Link>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
