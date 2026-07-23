"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { toast } from "react-hot-toast";

interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  weight: number;
  brand: { name: string };
  part_number?: string;
  suitable_vehicle?: string;
  engine_model?: string;
  is_on_offer?: boolean;
  offer_price?: number;
}

interface CartItem extends Product {
  quantity: number;
  warehouse_id: number;
  warehouse_name: string;
  stock_quantity?: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, warehouseId: number, warehouseName: string, quantity?: number, stockQuantity?: number) => void;
  removeFromCart: (productId: number, warehouseId: number) => void;
  updateQuantity: (productId: number, warehouseId: number, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
  cartWeight: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);

  // Load cart from local storage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem("spare_cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  // Save cart to local storage whenever it changes
  useEffect(() => {
    localStorage.setItem("spare_cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product, warehouseId: number, warehouseName: string, quantity: number = 1, stockQuantity?: number) => {
    const activePrice = (product.is_on_offer && product.offer_price)
      ? Number(product.offer_price)
      : Number(product.price);

    const cartProduct = {
      ...product,
      price: activePrice
    };

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && item.warehouse_id === warehouseId);
      if (existing) {
        if (existing.stock_quantity !== undefined && existing.quantity + quantity > existing.stock_quantity) {
          toast.error(`Cannot add more. Only ${existing.stock_quantity} available in stock!`, {
            style: { background: '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '12px' }
          });
          return prev;
        }
        return prev.map(item => 
          (item.id === product.id && item.warehouse_id === warehouseId) 
            ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      
      if (stockQuantity !== undefined && quantity > stockQuantity) {
        toast.error(`Only ${stockQuantity} available in stock!`, {
          style: { background: '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '12px' }
        });
        return prev;
      }
      return [...prev, { ...cartProduct, quantity, warehouse_id: warehouseId, warehouse_name: warehouseName, stock_quantity: stockQuantity }];
    });
  };

  const removeFromCart = (productId: number, warehouseId: number) => {
    setCart(prev => prev.filter(item => !(item.id === productId && item.warehouse_id === warehouseId)));
  };

  const updateQuantity = (productId: number, warehouseId: number, quantity: number) => {
    if (quantity < 1) return;
    setCart(prev => prev.map(item => {
      if (item.id === productId && item.warehouse_id === warehouseId) {
        if (item.stock_quantity !== undefined && quantity > item.stock_quantity) {
          toast.error(`Stock limit reached! Only ${item.stock_quantity} available.`, {
            style: { background: '#ef4444', color: '#fff', fontWeight: 'bold', fontSize: '12px' }
          });
          return item;
        }
        return { ...item, quantity };
      }
      return item;
    }));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartWeight = cart.reduce((total, item) => total + (Number(item.weight || 0) * item.quantity), 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal, cartWeight }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
