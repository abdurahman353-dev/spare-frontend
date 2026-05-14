"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { ImageIcon, X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

interface ProductViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: any;
}

export function ProductViewModal({ isOpen, onClose, product }: ProductViewModalProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  if (!product) return null;

  const nextImage = () => {
    if (product.images && product.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
    }
  };

  const prevImage = () => {
    if (product.images && product.images.length > 0) {
      setCurrentImageIndex((prev) => (prev === 0 ? product.images.length - 1 : prev - 1));
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-white rounded-xl shadow-lg border border-zinc-200 p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b border-zinc-100 bg-zinc-50 relative">
          <DialogTitle className="text-xl font-bold text-zinc-900">{product.name}</DialogTitle>
          <p className="text-sm text-zinc-500 font-medium mt-1">SKU: {product.sku}</p>
        </DialogHeader>

        <div className="p-6 space-y-6">
          {/* Images Section */}
          <div className="relative h-64 bg-zinc-100 rounded-lg overflow-hidden flex items-center justify-center border border-zinc-200">
            {product.images && product.images.length > 0 ? (
              <>
                <Image 
                  src={product.images[currentImageIndex]} 
                  alt={product.name} 
                  fill 
                  className="object-contain" 
                />
                {product.images.length > 1 && (
                  <>
                    <button 
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button 
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 bg-black/50 text-white rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      {currentImageIndex + 1} / {product.images.length}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-zinc-400">
                <ImageIcon className="h-10 w-10 mb-2" />
                <span className="text-sm font-medium">No Images Available</span>
              </div>
            )}
          </div>

          {/* Details Section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Category</span>
              <p className="text-sm font-semibold text-zinc-900">{product.category?.name || "N/A"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Brand</span>
              <p className="text-sm font-semibold text-zinc-900">{product.brand?.name || "N/A"}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Price</span>
              <p className="text-lg font-black text-primary">Ksh {Number(product.price).toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Status</span>
              <div>
                <Badge variant={product.status === "Active" ? "default" : "outline"} className={
                  product.status === "Active" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-red-600 text-white"
                }>
                  {product.status}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="space-y-1">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Description</span>
            <p className="text-sm text-zinc-600 bg-zinc-50 p-3 rounded-lg border border-zinc-100 min-h-[60px]">
              {product.description || "No description provided."}
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-zinc-100 flex justify-end">
          <Button onClick={onClose} variant="outline" className="rounded-lg font-bold">Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
