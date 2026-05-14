"use client";

import { useEffect, useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import api from "@/lib/axios";
import { Loader2, ArrowRightLeft, PackagePlus } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import toast from "react-hot-toast";

interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  type: "update" | "transfer";
  initialData?: any;
}

export function StockModal({ isOpen, onClose, onSuccess, type, initialData }: StockModalProps) {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    id: "",
    product_id: "",
    warehouse_id: "",
    from_warehouse_id: "",
    to_warehouse_id: "",
    quantity: "", // Absolute quantity for add, transfer amount for transfer
    adjustment: "", // For edit mode (increment/decrement)
    min_stock: "10"
  });

  useEffect(() => {
    if (isOpen) {
      fetchOptions();
      if (type === "update") {
        if (initialData) {
          // Edit mode
          setFormData({
            id: initialData.id?.toString() || "",
            product_id: initialData.product_id?.toString() || initialData.product?.id?.toString() || "",
            warehouse_id: initialData.warehouse_id?.toString() || initialData.warehouse?.id?.toString() || "",
            from_warehouse_id: "",
            to_warehouse_id: "",
            quantity: initialData.quantity?.toString() || "0",
            adjustment: "",
            min_stock: initialData.min_stock?.toString() || "10"
          });
        } else {
          // Add mode
          setFormData({
            id: "",
            product_id: "",
            warehouse_id: "",
            from_warehouse_id: "",
            to_warehouse_id: "",
            quantity: "",
            adjustment: "",
            min_stock: "10"
          });
        }
      } else if (type === "transfer") {
        setFormData({
          id: "",
          product_id: initialData?.product_id?.toString() || initialData?.product?.id?.toString() || "",
          warehouse_id: "",
          from_warehouse_id: initialData?.warehouse_id?.toString() || initialData?.warehouse?.id?.toString() || "",
          to_warehouse_id: "",
          quantity: "",
          adjustment: "",
          min_stock: "10"
        });
      }
    }
  }, [isOpen, initialData, type]);

  const fetchOptions = async () => {
    try {
      const [wRes, pRes] = await Promise.all([
        api.get("/warehouses"),
        api.get("/products")
      ]);
      setWarehouses(wRes.data);
      setProducts(pRes.data);
    } catch (err) {
      toast.error("Failed to fetch warehouses and products.");
    }
  };

  const handleAddWarehouse = async (name: string) => {
    try {
      const code = "WH-" + Math.floor(Math.random() * 10000);
      const res = await api.post("/warehouses", { name, location: "TBD", code });
      const newWarehouse = res.data;
      setWarehouses((prev) => [...prev, newWarehouse]);
      setFormData((prev) => ({ ...prev, warehouse_id: newWarehouse.id.toString() }));
      toast.success("Warehouse added successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to add warehouse");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (type === "update") {
        if (!formData.product_id) return toast.error("Please select a part.");
        if (!formData.warehouse_id) return toast.error("Please select a warehouse.");
        if (formData.min_stock === "") return toast.error("Please enter the low stock alert level.");

        if (formData.id) {
          // Update existing inventory record
          const currentQty = initialData?.quantity || 0;
          const adjustment = formData.adjustment ? Number(formData.adjustment) : 0;
          const newQuantity = currentQty + adjustment;

          await api.put(`/inventory/${formData.id}`, {
            product_id: Number(formData.product_id),
            warehouse_id: Number(formData.warehouse_id),
            quantity: newQuantity,
            min_stock: Number(formData.min_stock)
          });
          toast.success("Stock updated successfully");
        } else {
          // Create new inventory record
          if (formData.quantity === "") return toast.error("Please enter the initial quantity.");
          
          await api.post("/inventory", {
            product_id: Number(formData.product_id),
            warehouse_id: Number(formData.warehouse_id),
            quantity: Number(formData.quantity),
            min_stock: Number(formData.min_stock)
          });
          toast.success("New stock record created");
        }
      } else {
        // Transfer logic
        if (!formData.product_id) return toast.error("Please select a part to transfer.");
        if (!formData.from_warehouse_id) return toast.error("Please select source warehouse.");
        if (!formData.to_warehouse_id) return toast.error("Please select destination warehouse.");
        if (formData.from_warehouse_id === formData.to_warehouse_id) return toast.error("Source and destination warehouses cannot be the same.");
        if (!formData.quantity || Number(formData.quantity) <= 0) return toast.error("Enter a valid transfer quantity.");

        await api.post("/inventory/transfer", {
          product_id: Number(formData.product_id),
          from_warehouse_id: Number(formData.from_warehouse_id),
          to_warehouse_id: Number(formData.to_warehouse_id),
          quantity: Number(formData.quantity)
        });
        toast.success("Stock transferred successfully");
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "An error occurred while saving.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px] bg-white rounded-xl shadow-lg border border-zinc-200">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center gap-3">
               <div className="text-zinc-600">
                {type === "transfer" ? <ArrowRightLeft className="h-5 w-5" /> : <PackagePlus className="h-5 w-5" />}
              </div>
              <DialogTitle className="text-xl font-bold">
                {type === "transfer" ? "Stock Transfer" : formData.id ? "Adjust Stock" : "Add Stock"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-6 space-y-4">
            {type === "update" ? (
              <>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-500">Part</Label>
                  <SearchableDropdown
                    items={products}
                    value={formData.product_id}
                    onChange={(val) => setFormData({ ...formData, product_id: val })}
                    placeholder="Search and select a part"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-500">Warehouse</Label>
                  <SearchableDropdown
                    items={warehouses}
                    value={formData.warehouse_id}
                    onChange={(val) => setFormData({ ...formData, warehouse_id: val })}
                    placeholder="Search and select warehouse"
                    onAdd={handleAddWarehouse}
                  />
                </div>
                
                {formData.id ? (
                  // Edit mode - Show Current Stock and Adjustment field
                  <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-4 rounded-lg border border-zinc-100">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-zinc-500">Current Stock</Label>
                      <div className="h-10 px-3 bg-white border border-zinc-200 rounded-lg flex items-center text-zinc-500 font-medium">
                        {initialData?.quantity} PCS
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold text-primary">Adjustment (+ / -)</Label>
                      <Input 
                        type="number"
                        value={formData.adjustment}
                        onChange={(e) => setFormData({ ...formData, adjustment: e.target.value })}
                        placeholder="e.g., 5 or -2"
                        className="h-10 border-zinc-200 rounded-lg focus-visible:ring-primary focus-visible:border-primary font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  // Add mode - Show Absolute Initial Stock field
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-zinc-500">Initial Quantity</Label>
                    <Input 
                      type="number"
                      value={formData.quantity}
                      onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                      placeholder="0"
                      className="h-10 border-zinc-200 rounded-lg"
                    />
                  </div>
                )}
                
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-500">Low Stock Alert Level</Label>
                  <Input 
                    type="number"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    placeholder="10"
                    className="h-10 border-zinc-200 rounded-lg"
                  />
                  <p className="text-[10px] text-zinc-400">Trigger alert when stock drops to this level or below.</p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-500">Select Part</Label>
                  <SearchableDropdown
                    items={products}
                    value={formData.product_id}
                    onChange={(val) => setFormData({ ...formData, product_id: val })}
                    placeholder="Search and select a part"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-zinc-500">From</Label>
                    <SearchableDropdown
                      items={warehouses}
                      value={formData.from_warehouse_id}
                      onChange={(val) => setFormData({ ...formData, from_warehouse_id: val })}
                      placeholder="Source"
                      onAdd={handleAddWarehouse}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold text-zinc-500">To</Label>
                    <SearchableDropdown
                      items={warehouses}
                      value={formData.to_warehouse_id}
                      onChange={(val) => setFormData({ ...formData, to_warehouse_id: val })}
                      placeholder="Destination"
                      onAdd={handleAddWarehouse}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-zinc-500">Transfer Quantity</Label>
                  <Input 
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="Enter amount"
                    className="h-10 border-zinc-200 rounded-lg"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="border-t pt-4 flex gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="rounded-lg">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-primary text-white hover:bg-primary/90 rounded-lg font-bold">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {type === "transfer" ? "Transfer Stock" : "Save Inventory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
