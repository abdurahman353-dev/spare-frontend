"use client";

import { useEffect, useState, useRef } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import api from "@/lib/axios";
import { Loader2, X, Upload, ImageIcon } from "lucide-react";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import Image from "next/image";
import toast from "react-hot-toast";

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: any;
}

const emptyForm = {
  sku: "",
  name: "",
  category_id: "",
  brand_id: "",
  price: "",
  weight: "1.00",
  description: "",
  status: "Active",
  images: [] as string[],
};

export function ProductModal({ isOpen, onClose, onSuccess, product }: ProductModalProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [previews, setPreviews] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchOptions();
      if (product) {
        setFormData({
          sku: product.sku || "",
          name: product.name || "",
          category_id: product.category_id?.toString() || "",
          brand_id: product.brand_id?.toString() || "",
          price: product.price?.toString() || "",
          weight: product.weight?.toString() || "1.00",
          description: product.description || "",
          status: product.status || "Active",
          images: product.images || [],
        });
        setPreviews(product.images || []);
      } else {
        setFormData({ ...emptyForm });
        setPreviews([]);
      }
    }
  }, [isOpen, product]);

  const fetchOptions = async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        api.get("/categories"),
        api.get("/brands"),
      ]);
      setCategories(catRes.data);
      setBrands(brandRes.data);
    } catch (err) {
      console.error("Failed to fetch options", err);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (previews.length + files.length > 5) {
      alert("Maximum 5 images allowed");
      return;
    }
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setPreviews((prev) => [...prev, base64]);
        setFormData((prev) => ({ ...prev, images: [...prev.images, base64] }));
      };
      reader.readAsDataURL(file);
    });
    // reset so same file can be re-selected
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  /* ---------- Category / Brand CRUD ---------- */
  const handleAddCategory = async (name: string) => {
    const res = await api.post("/categories", { name });
    const newCat = res.data;
    setCategories((prev) => [...prev, newCat]);
    setFormData((prev) => ({ ...prev, category_id: newCat.id.toString() }));
  };

  const handleDeleteCategory = async (id: string | number) => {
    await api.delete(`/categories/${id}`);
    setCategories((prev) => prev.filter((c) => c.id.toString() !== id.toString()));
    if (formData.category_id === id.toString()) {
      setFormData((prev) => ({ ...prev, category_id: "" }));
    }
  };

  const handleAddBrand = async (name: string) => {
    const res = await api.post("/brands", { name });
    const newBrand = res.data;
    setBrands((prev) => [...prev, newBrand]);
    setFormData((prev) => ({ ...prev, brand_id: newBrand.id.toString() }));
  };

  const handleDeleteBrand = async (id: string | number) => {
    await api.delete(`/brands/${id}`);
    setBrands((prev) => prev.filter((b) => b.id.toString() !== id.toString()));
    if (formData.brand_id === id.toString()) {
      setFormData((prev) => ({ ...prev, brand_id: "" }));
    }
  };

  /* ---------- Submit ---------- */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Frontend validation
    if (!formData.sku.trim()) return toast.error("Part SKU is required.");
    if (!formData.name.trim()) return toast.error("Product Name is required.");
    if (!formData.category_id) return toast.error("Please select a category.");
    if (!formData.brand_id) return toast.error("Please select a brand.");
    if (!formData.price || Number(formData.price) <= 0) return toast.error("Enter a valid price.");

    setLoading(true);
    try {
      const payload = {
        sku: formData.sku.trim(),
        name: formData.name.trim(),
        category_id: Number(formData.category_id),
        brand_id: Number(formData.brand_id),
        price: Number(formData.price),
        weight: Number(formData.weight || 1.00),
        description: formData.description,
        status: formData.status,
        images: formData.images,
      };

      if (product) {
        await api.put(`/products/${product.id}`, payload);
        toast.success("Product updated successfully!");
      } else {
        await api.post("/products", payload);
        toast.success("Product added successfully!");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (err?.response?.data?.errors
          ? Object.values(err.response.data.errors).flat().join(" ")
          : null) ||
        "Failed to save product. Please try again.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] bg-white rounded-xl shadow-xl border border-zinc-200 p-0 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b flex-shrink-0">
          <DialogTitle className="text-xl font-bold">
            {product ? "Edit Product" : "Add New Product"}
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Product Images (Max 5)
              </Label>
              <div className="grid grid-cols-6 gap-2">
                {previews.map((src, idx) => (
                  <div
                    key={idx}
                    className="relative aspect-square rounded-lg overflow-hidden border border-zinc-200 group bg-zinc-50"
                  >
                    <Image src={src} alt="Preview" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute top-1 right-1 h-5 w-5 bg-black/60 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {previews.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center text-zinc-400 hover:border-primary hover:text-primary transition-all bg-zinc-50"
                  >
                    <Upload className="h-4 w-4 mb-1" />
                    <span className="text-[9px] font-bold">Upload</span>
                  </button>
                )}
                {previews.length === 0 && (
                  <div className="col-span-5 flex items-center justify-center h-full text-xs text-zinc-400 font-medium">
                    <ImageIcon className="h-4 w-4 mr-2" /> No images added yet
                  </div>
                )}
              </div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
                multiple
                accept="image/*"
              />
            </div>

            {/* Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-zinc-500">Part SKU *</Label>
                <Input
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="MB-BP-001"
                  className="h-10 border-zinc-200 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-zinc-500">Product Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Front Brake Pads Set"
                  className="h-10 border-zinc-200 rounded-lg"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-zinc-500">Category *</Label>
                <SearchableDropdown
                  items={categories}
                  value={formData.category_id}
                  onChange={(val) => setFormData({ ...formData, category_id: val })}
                  placeholder="Select Category"
                  onAdd={handleAddCategory}
                  onDelete={handleDeleteCategory}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-zinc-500">Brand *</Label>
                <SearchableDropdown
                  items={brands}
                  value={formData.brand_id}
                  onChange={(val) => setFormData({ ...formData, brand_id: val })}
                  placeholder="Select Brand"
                  onAdd={handleAddBrand}
                  onDelete={handleDeleteBrand}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-zinc-500">Price (Ksh) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="0.00"
                  className="h-10 border-zinc-200 rounded-lg font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-zinc-500">Weight (KG) *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  placeholder="1.00"
                  className="h-10 border-zinc-200 rounded-lg font-bold text-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold text-zinc-500">Status</Label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="flex h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <Label className="text-xs font-semibold text-zinc-500">Technical Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter detailed specifications..."
                  className="min-h-[80px] border-zinc-200 rounded-lg resize-none"
                />
              </div>
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
              ) : product ? (
                "UPDATE PRODUCT"
              ) : (
                "SAVE PRODUCT"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
