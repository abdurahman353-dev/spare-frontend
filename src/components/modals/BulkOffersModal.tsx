"use client";

import { useEffect, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import api from "@/lib/axios";
import { API_ENDPOINTS } from "@/lib/apis";
import { Loader2, Percent, Ban, Check, X, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";

interface BulkOffersModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  selectedProducts: any[];
}

interface OfferItem {
  id: number;
  sku: string;
  name: string;
  original_price: number;
  is_on_offer: boolean;
  offer_price: string;
}

export function BulkOffersModal({ isOpen, onClose, onSuccess, selectedProducts }: BulkOffersModalProps) {
  const [items, setItems] = useState<OfferItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [discountPercent, setDiscountPercent] = useState("");

  useEffect(() => {
    if (isOpen) {
      setItems(
        selectedProducts.map((p) => ({
          id: p.id,
          sku: p.sku || "",
          name: p.name || "",
          original_price: Number(p.original_price || p.price || 0),
          is_on_offer: !!p.is_on_offer,
          offer_price: p.offer_price?.toString() || "",
        }))
      );
      setDiscountPercent("");
    }
  }, [isOpen, selectedProducts]);

  const handleToggleOffer = (id: number, checked: boolean) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const defaultOfferPrice = checked && !item.offer_price 
            ? (item.original_price * 0.9).toFixed(2) // 10% discount default
            : item.offer_price;
          return {
            ...item,
            is_on_offer: checked,
            offer_price: checked ? defaultOfferPrice : "",
          };
        }
        return item;
      })
    );
  };

  const handlePriceChange = (id: number, val: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, offer_price: val } : item))
    );
  };

  const applyBulkDiscount = () => {
    const percent = parseFloat(discountPercent);
    if (isNaN(percent) || percent <= 0 || percent >= 100) {
      toast.error("Please enter a discount percentage between 1 and 99");
      return;
    }

    setItems((prev) =>
      prev.map((item) => {
        const discounted = item.original_price * (1 - percent / 100);
        return {
          ...item,
          is_on_offer: true,
          offer_price: discounted.toFixed(2),
        };
      })
    );
    toast.success(`Applied ${percent}% discount to selected parts`);
  };

  const removeAllOffers = () => {
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        is_on_offer: false,
        offer_price: "",
      }))
    );
    toast.success("Cleared offers for all selected parts");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate prices for items on offer
    for (const item of items) {
      if (item.is_on_offer) {
        const op = parseFloat(item.offer_price);
        if (isNaN(op) || op <= 0) {
          toast.error(`Please enter a valid offer price for SKU: ${item.sku}`);
          return;
        }
        if (op >= item.original_price) {
          toast.error(`Offer price must be less than original price for SKU: ${item.sku}`);
          return;
        }
      }
    }

    setLoading(true);
    try {
      const payload = {
        products: items.map((item) => ({
          id: item.id,
          is_on_offer: item.is_on_offer,
          offer_price: item.is_on_offer ? parseFloat(item.offer_price) : null,
        })),
      };

      await api.post(API_ENDPOINTS.products.bulkOffers, payload);
      toast.success("Bulk offers updated successfully!");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to update bulk offers");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] bg-white rounded-xl shadow-xl border border-zinc-200 p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0 bg-zinc-50">
          <DialogTitle className="text-xl font-bold text-zinc-900 flex items-center gap-2">
            Configure Offers in Bulk
            <span className="text-xs bg-blue-100 text-blue-800 font-extrabold px-2.5 py-0.5 rounded-full uppercase">
              {items.length} Parts Selected
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Bulk Action Controls */}
        <div className="bg-zinc-50 px-6 py-4 border-b flex flex-wrap gap-4 items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Label htmlFor="discount" className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
              Quick Discount:
            </Label>
            <div className="relative w-32">
              <Input
                id="discount"
                type="number"
                min="1"
                max="99"
                placeholder="10"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
                className="h-9 pr-6 border-zinc-200 text-sm font-bold"
              />
              <Percent className="absolute right-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            </div>
            <Button
              type="button"
              onClick={applyBulkDiscount}
              className="bg-primary hover:bg-primary/95 text-white h-9 px-4 rounded-lg font-bold text-xs uppercase"
            >
              Apply
            </Button>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={removeAllOffers}
            className="border-rose-200 text-rose-600 hover:bg-rose-50/50 hover:border-rose-300 h-9 font-bold text-xs uppercase flex items-center gap-1.5"
          >
            <Ban className="h-4 w-4" /> Remove Offers
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          {/* Scrollable List */}
          <div className="overflow-y-auto flex-1 p-6">
            <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white">
              <Table>
                <TableHeader className="bg-zinc-50">
                  <TableRow>
                    <TableHead className="font-semibold text-zinc-900 w-[140px]">SKU</TableHead>
                    <TableHead className="font-semibold text-zinc-900">Name</TableHead>
                    <TableHead className="font-semibold text-zinc-900 text-right w-[110px]">Orig Price</TableHead>
                    <TableHead className="font-semibold text-zinc-900 text-center w-[100px]">On Offer</TableHead>
                    <TableHead className="font-semibold text-zinc-900 w-[150px]">Offer Price (Ksh)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow key={item.id} className="hover:bg-zinc-50/40">
                      <TableCell className="font-bold text-zinc-900 text-xs">{item.sku}</TableCell>
                      <TableCell className="font-medium text-zinc-700 text-sm max-w-[200px] truncate">
                        {item.name}
                      </TableCell>
                      <TableCell className="text-right font-bold text-zinc-500 text-sm">
                        {item.original_price.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={item.is_on_offer}
                          onChange={(e) => handleToggleOffer(item.id, e.target.checked)}
                          className="rounded border-zinc-300 text-rose-600 focus:ring-rose-500 h-4 w-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          disabled={!item.is_on_offer}
                          value={item.offer_price}
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                          placeholder="Slashed Price"
                          className={`h-9 border-zinc-200 text-sm font-bold ${
                            item.is_on_offer
                              ? "text-rose-600 border-rose-200 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/5"
                              : "text-zinc-400 bg-zinc-50"
                          }`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-white flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg min-w-[100px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#0052cc] text-white hover:bg-[#0747a6] rounded-lg font-black px-8 text-[11px] tracking-widest uppercase shadow-sm min-w-[140px]"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  SAVING...
                </span>
              ) : (
                "SAVE BULK OFFERS"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
