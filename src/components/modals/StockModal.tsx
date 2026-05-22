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
  pendingItems?: any[];
}

export function StockModal({ isOpen, onClose, onSuccess, type, initialData, pendingItems }: StockModalProps) {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkFormData, setBulkFormData] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    id: "",
    product_id: "",
    warehouse_id: "",
    from_warehouse_id: "",
    to_warehouse_id: "",
    quantity: "", // Absolute quantity for add, transfer amount for transfer
    adjustment: "", // For edit mode (increment/decrement)
    min_stock: ""
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
            min_stock: initialData.min_stock?.toString() || ""
          });
          setBulkFormData([]);
        } else if (pendingItems && pendingItems.length > 0) {
          // Bulk assign mode for pending items
          setBulkFormData(pendingItems.map(item => ({
            id: item.id?.toString(),
            product_id: item.product_id?.toString() || item.product?.id?.toString(),
            product_name: item.product?.name || "Unknown Product",
            warehouse_id: "",
            quantity: "",
            min_stock: ""
          })));
          setFormData({
            id: "",
            product_id: "",
            warehouse_id: "",
            from_warehouse_id: "",
            to_warehouse_id: "",
            quantity: "",
            adjustment: "",
            min_stock: ""
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
            min_stock: ""
          });
          setBulkFormData([]);
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
          min_stock: ""
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

  const handleEditWarehouse = async (id: string | number, newName: string) => {
    try {
      await api.put(`/warehouses/${id}`, { name: newName });
      setWarehouses((prev) =>
        prev.map((w) => (w.id.toString() === id.toString() ? { ...w, name: newName } : w))
      );
      toast.success("Warehouse renamed successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to rename warehouse");
    }
  };

  const handleDeleteWarehouse = async (id: string | number) => {
    try {
      await api.delete(`/warehouses/${id}`);
      setWarehouses((prev) => prev.filter((w) => w.id.toString() !== id.toString()));
      if (formData.warehouse_id === id.toString()) {
        setFormData((prev) => ({ ...prev, warehouse_id: "" }));
      }
      if (formData.from_warehouse_id === id.toString()) {
        setFormData((prev) => ({ ...prev, from_warehouse_id: "" }));
      }
      if (formData.to_warehouse_id === id.toString()) {
        setFormData((prev) => ({ ...prev, to_warehouse_id: "" }));
      }
      toast.success("Warehouse deleted successfully");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to delete warehouse");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      if (type === "update" && bulkFormData.length > 0) {
        const itemsToUpdate = bulkFormData.filter(item => item.warehouse_id);
        
        if (itemsToUpdate.length === 0) {
          toast.error("Please select a warehouse for at least one item.");
          setLoading(false);
          return;
        }

        for (const item of itemsToUpdate) {
          if (!item.quantity && !item.min_stock) {
            toast.error("Please enter quantity and low stock alert");
            setLoading(false);
            return;
          }
          if (!item.quantity) {
            toast.error("Please enter quantity");
            setLoading(false);
            return;
          }
          if (!item.min_stock) {
            toast.error("Please enter low stock alert");
            setLoading(false);
            return;
          }
        }

        await Promise.all(itemsToUpdate.map(item => {
          const payload = {
            product_id: Number(item.product_id),
            warehouse_id: Number(item.warehouse_id),
            quantity: Number(item.quantity),
            min_stock: Number(item.min_stock)
          };
          
          if (item.id) {
            return api.put(`/inventory/${item.id}`, payload);
          } else {
            return api.post("/inventory", payload);
          }
        }));
        
        toast.success("Pending stock assigned successfully!");
        onSuccess();
        onClose();
        return;
      }

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
                {type === "transfer" ? "Stock Transfer" : bulkFormData.length > 0 ? "Assign Pending Stock" : formData.id ? "Adjust Stock" : "Add Stock"}
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="py-6 space-y-4">
            {type === "update" && bulkFormData.length > 0 ? (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="bg-blue-50 text-blue-700 p-3 rounded-lg text-xs font-medium border border-blue-100">
                  Assign stock to pending items. Leave warehouse unselected to skip assigning an item.
                </div>
                {bulkFormData.map((item, index) => (
                  <div key={item.id || `pending-${index}`} className="p-4 border border-zinc-200 rounded-lg space-y-3 bg-zinc-50 relative">
                    <h4 className="font-bold text-sm text-zinc-900 border-b border-zinc-200 pb-2">{item.product_name}</h4>
                    <div className="space-y-3">
                      <div>
                        <Label className="text-xs font-semibold text-zinc-500">Warehouse</Label>
                        <SearchableDropdown
                          items={warehouses}
                          value={item.warehouse_id}
                          onChange={(val) => {
                            const newData = [...bulkFormData];
                            newData[index].warehouse_id = val;
                            setBulkFormData(newData);
                          }}
                          placeholder="Select warehouse"
                          onAdd={handleAddWarehouse}
                          onEdit={handleEditWarehouse}
                          onDelete={handleDeleteWarehouse}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-semibold text-zinc-500">Quantity</Label>
                          <Input 
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const newData = [...bulkFormData];
                              newData[index].quantity = e.target.value;
                              setBulkFormData(newData);
                            }}
                            placeholder="0"
                            className="h-9 border-zinc-200 rounded-lg bg-white"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-semibold text-zinc-500">Low Stock Alert</Label>
                          <Input 
                            type="number"
                            value={item.min_stock}
                            onChange={(e) => {
                              const newData = [...bulkFormData];
                              newData[index].min_stock = e.target.value;
                              setBulkFormData(newData);
                            }}
                            placeholder="10"
                            className="h-9 border-zinc-200 rounded-lg bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : type === "update" ? (
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
                    onEdit={handleEditWarehouse}
                    onDelete={handleDeleteWarehouse}
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
                      onEdit={handleEditWarehouse}
                      onDelete={handleDeleteWarehouse}
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
                      onEdit={handleEditWarehouse}
                      onDelete={handleDeleteWarehouse}
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
