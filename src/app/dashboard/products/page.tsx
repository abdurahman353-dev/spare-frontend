"use client";

import { useEffect, useState, useMemo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Plus, Search, Filter, MoreHorizontal, Edit, Trash2, Loader2, Package, ImageIcon, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import api from "@/lib/axios";
import { ProductModal } from "@/components/modals/ProductModal";
import { ProductViewModal } from "@/components/modals/ProductViewModal";
import Image from "next/image";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";

export default function ProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<any>(null);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get("/products");
      setProducts(res.data);
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this product?")) {
      try {
        await api.delete(`/products/${id}`);
        fetchProducts();
      } catch (err) {
        console.error("Delete failed", err);
      }
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const openViewModal = (product: any) => {
    setViewingProduct(product);
    setIsViewModalOpen(true);
  };

  // Advanced Filtering & Search
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const name = product.name || "";
      const sku = product.sku || "";
      const brand = product.brand?.name || "";
      
      const matchesSearch = 
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        brand.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesCategory = !selectedCategoryId || product.category?.id.toString() === selectedCategoryId;
      const matchesName = !selectedName || product.name === selectedName;
      const matchesBrand = !selectedBrandId || product.brand?.id.toString() === selectedBrandId;
      const matchesStatus = !selectedStatus || product.status === selectedStatus;
      
      return matchesSearch && matchesCategory && matchesName && matchesBrand && matchesStatus;
    });
  }, [products, searchQuery, selectedCategoryId, selectedName, selectedBrandId, selectedStatus]);

  const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean).map(c => JSON.stringify(c)))).map(c => JSON.parse(c as string));
  const filterCategoryOptions = uniqueCategories.map(c => ({ id: c.id.toString(), name: c.name }));

  const uniqueNames = Array.from(new Set(products.map(p => p.name).filter(Boolean)));
  const filterNameOptions = uniqueNames.map(name => ({ id: name, name: name }));

  const uniqueBrands = Array.from(new Set(products.map(p => p.brand).filter(Boolean).map(b => JSON.stringify(b)))).map(b => JSON.parse(b as string));
  const filterBrandOptions = uniqueBrands.map(b => ({ id: b.id.toString(), name: b.name }));

  const filterStatusOptions = [
    { id: "Active", name: "Active" },
    { id: "Inactive", name: "Inactive" }
  ];

  const handleClearFilters = () => {
    setSelectedCategoryId("");
    setSelectedName("");
    setSelectedBrandId("");
    setSelectedStatus("");
    setSearchQuery("");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Products</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage your genuine Mercedes-Benz parts catalog.</p>
        </div>
        <Button 
          onClick={openAddModal}
          className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm font-bold"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search by SKU, Name or Brand..." 
            className="pl-10 h-10 border-zinc-200 rounded-lg bg-white w-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-[180px]">
          <SearchableDropdown 
            items={filterNameOptions}
            value={selectedName}
            onChange={setSelectedName}
            placeholder="All Names"
          />
        </div>
        <div className="w-full sm:w-[180px]">
          <SearchableDropdown 
            items={filterBrandOptions}
            value={selectedBrandId}
            onChange={setSelectedBrandId}
            placeholder="All Brands"
          />
        </div>
        <div className="w-full sm:w-[180px]">
          <SearchableDropdown 
            items={filterCategoryOptions}
            value={selectedCategoryId}
            onChange={setSelectedCategoryId}
            placeholder="All Categories"
          />
        </div>
        <div className="w-full sm:w-[150px]">
          <select 
            className="h-10 px-3 border border-zinc-200 rounded-lg text-sm font-medium bg-white outline-none focus:ring-2 focus:ring-primary/20 w-full text-zinc-600"
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {filterStatusOptions.map(opt => (
              <option key={opt.id} value={opt.id}>{opt.name}</option>
            ))}
          </select>
        </div>
        <Button variant="outline" className="w-full sm:w-auto rounded-lg h-10 px-3 border-zinc-200" onClick={handleClearFilters}>
           <Filter className="h-4 w-4 text-zinc-500 mr-2" /> Clear
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-zinc-200 overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50/50">
            <TableRow>
              <TableHead className="px-6 font-semibold text-zinc-900">SKU</TableHead>
              <TableHead className="font-semibold text-zinc-900">Name</TableHead>
              <TableHead className="font-semibold text-zinc-900">Category</TableHead>
              <TableHead className="font-semibold text-zinc-900">Brand</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-right">Price</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-center">Status</TableHead>
              <TableHead className="px-6 w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-zinc-500 font-medium">Synchronizing parts...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-48 text-center text-zinc-500">
                   No products found in the catalog.
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow key={product.id} className="hover:bg-zinc-50/50 transition-colors">
                  <TableCell className="px-6 font-bold text-zinc-900">{product.sku}</TableCell>
                  <TableCell className="font-semibold text-zinc-700">{product.name}</TableCell>
                  <TableCell className="text-zinc-500 text-xs font-bold uppercase tracking-tight">
                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 border-none px-2 py-0.5">
                      {product.category?.name || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-zinc-700 text-sm">
                    {product.brand?.name || "N/A"}
                  </TableCell>
                  <TableCell className="text-right font-black text-zinc-900">Ksh {Number(product.price).toLocaleString()}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={product.status === "Active" ? "default" : "outline"} className={cn(
                      "rounded-full px-3 text-[10px] font-bold uppercase border-none tracking-wider",
                      product.status === "Active" ? "bg-emerald-500 text-white hover:bg-emerald-600" : "bg-red-600 text-white hover:bg-red-700"
                    )}>
                      {product.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0 rounded-full")}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl border-zinc-200 shadow-xl p-1">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[10px] font-black text-zinc-400 uppercase px-2 py-1.5">Options</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openViewModal(product)} className="cursor-pointer rounded-lg font-bold text-sm">
                            <Eye className="mr-2 h-4 w-4 text-zinc-400" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditModal(product)} className="cursor-pointer rounded-lg font-bold text-sm">
                            <Edit className="mr-2 h-4 w-4 text-zinc-400" /> Edit Part
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleDelete(product.id)} className="text-red-600 cursor-pointer rounded-lg font-bold text-sm">
                            <Trash2 className="mr-2 h-4 w-4" /> Remove
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ProductModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchProducts}
        product={editingProduct}
      />
      <ProductViewModal 
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        product={viewingProduct}
      />
    </div>
  );
}
