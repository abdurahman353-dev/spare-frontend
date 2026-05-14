"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface Product {
  id: number;
  name: string;
  sku: string;
  price: number;
  brand: { name: string };
}

interface CartItem extends Product {
  quantity: number;
  warehouse_id: number;
  warehouse_name: string;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, warehouseId: number, warehouseName: string) => void;
  removeFromCart: (productId: number, warehouseId: number) => void;
  updateQuantity: (productId: number, warehouseId: number, quantity: number) => void;
  clearCart: () => void;
  cartTotal: number;
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

  const addToCart = (product: Product, warehouseId: number, warehouseName: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && item.warehouse_id === warehouseId);
      if (existing) {
        return prev.map(item => 
          (item.id === product.id && item.warehouse_id === warehouseId) 
            ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, warehouse_id: warehouseId, warehouse_name: warehouseName }];
    });
  };

  const removeFromCart = (productId: number, warehouseId: number) => {
    setCart(prev => prev.filter(item => !(item.id === productId && item.warehouse_id === warehouseId)));
  };

  const updateQuantity = (productId: number, warehouseId: number, quantity: number) => {
    if (quantity < 1) return;
    setCart(prev => prev.map(item => 
      (item.id === productId && item.warehouse_id === warehouseId) ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);

  return (
    <CartContext.Provider value={{ cart, addToCart, removeFromCart, updateQuantity, clearCart, cartTotal }}>
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
