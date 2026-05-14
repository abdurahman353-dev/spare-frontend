"use client";

import { useEffect, useState, useMemo } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Search, Filter, RefreshCw, ArrowRightLeft, Loader2, MoreHorizontal, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import api from "@/lib/axios";
import { cn } from "@/lib/utils";
import { StockModal } from "@/components/modals/StockModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function InventoryPage() {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [selectedBrandId, setSelectedBrandId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"update" | "transfer">("update");
  const [selectedItem, setSelectedItem] = useState<any>(null);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await api.get("/inventory");
      setInventory(res.data);
    } catch (err) {
      console.error("Failed to fetch inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const getStatus = (item: any) => {
    if (item.warehouse_id === null) return "PENDING ASSIGNMENT";
    if (item.quantity <= 0) return "OUT OF STOCK";
    if (item.quantity <= item.min_stock) return "LOW STOCK";
    return "IN STOCK";
  };

  const openUpdateModal = (item?: any) => {
    setSelectedItem(item || null);
    setModalType("update");
    setIsModalOpen(true);
  };

  const openTransferModal = (item?: any) => {
    setSelectedItem(item || null);
    setModalType("transfer");
    setIsModalOpen(true);
  };

  // Advanced Filtering
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const name = item.product?.name || "";
      const sku = item.product?.sku || "";
      const warehouse = item.warehouse?.name || "";
      
      const matchesSearch = 
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sku.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesWarehouse = !selectedWarehouseId || item.warehouse?.id.toString() === selectedWarehouseId;
      const matchesName = !selectedName || item.product?.name === selectedName;
      const matchesBrand = !selectedBrandId || item.product?.brand?.id.toString() === selectedBrandId;
      const matchesStatus = !selectedStatus || getStatus(item) === selectedStatus;
      
      return matchesSearch && matchesWarehouse && matchesName && matchesBrand && matchesStatus;
    });
  }, [inventory, searchQuery, selectedWarehouseId, selectedName, selectedBrandId, selectedStatus]);

  const uniqueWarehouses = Array.from(new Set(inventory.map(i => i.warehouse).filter(Boolean).map(w => JSON.stringify(w)))).map(w => JSON.parse(w as string));
  const filterWarehouseOptions = uniqueWarehouses.map(w => ({ id: w.id?.toString() || "unassigned", name: w.name }));

  const uniqueNames = Array.from(new Set(inventory.map(i => i.product?.name).filter(Boolean)));
  const filterNameOptions = uniqueNames.map(name => ({ id: name, name: name }));

  const uniqueBrands = Array.from(new Set(inventory.map(i => i.product?.brand).filter(Boolean).map(b => JSON.stringify(b)))).map(b => JSON.parse(b as string));
  const filterBrandOptions = uniqueBrands.map(b => ({ id: b.id?.toString() || "", name: b.name }));

  const filterStatusOptions = [
    { id: "IN STOCK", name: "In Stock" },
    { id: "LOW STOCK", name: "Low Stock" },
    { id: "OUT OF STOCK", name: "Out of Stock" },
    { id: "PENDING ASSIGNMENT", name: "Pending Assignment" }
  ];

  const handleClearFilters = () => {
    setSelectedWarehouseId("");
    setSelectedName("");
    setSelectedBrandId("");
    setSelectedStatus("");
    setSearchQuery("");
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Inventory Management</h1>
          <p className="text-zinc-500 text-sm mt-1">Monitor and relocate stock across your warehouses.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={openTransferModal}
            className="rounded-lg shadow-sm"
          >
            <ArrowRightLeft className="mr-2 h-4 w-4" /> Stock Transfer
          </Button>
          <Button 
            onClick={() => openUpdateModal()} 
            className="bg-primary text-white hover:bg-primary/90 rounded-lg shadow-sm"
          >
            <RefreshCw className="mr-2 h-4 w-4" /> Update Stock
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <Input 
            placeholder="Search by SKU or Product Name..." 
            className="pl-10 h-10 border-zinc-200 rounded-lg w-full"
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
            items={filterWarehouseOptions}
            value={selectedWarehouseId}
            onChange={setSelectedWarehouseId}
            placeholder="All Warehouses"
          />
        </div>
        <div className="w-full sm:w-[160px]">
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
              <TableHead className="font-semibold text-zinc-900">Product Name</TableHead>
              <TableHead className="font-semibold text-zinc-900">Brand</TableHead>
              <TableHead className="font-semibold text-zinc-900">Warehouse</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-right">Current Stock</TableHead>
              <TableHead className="font-semibold text-zinc-900 text-center">Status</TableHead>
              <TableHead className="px-6 w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-zinc-500">Scanning inventory...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredInventory.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-48 text-center text-zinc-500">
                   No inventory records found.
                </TableCell>
              </TableRow>
            ) : (
              filteredInventory.map((item, idx) => (
                <TableRow key={item.id || `unassigned-${item.product.id}-${idx}`} className="hover:bg-zinc-50/50">
                  <TableCell className="px-6 font-medium text-zinc-900">{item.product?.sku}</TableCell>
                  <TableCell className="font-medium text-sm">{item.product?.name}</TableCell>
                  <TableCell className="text-zinc-500 text-xs font-bold uppercase tracking-tight">
                    {item.product?.brand?.name || "N/A"}
                  </TableCell>
                  <TableCell className="text-zinc-600 text-sm">
                    <div className="flex items-center gap-1.5">
                      <MapPin className={cn("h-3.5 w-3.5", item.warehouse_id ? "text-emerald-500" : "text-zinc-300")} />
                      {item.warehouse?.name || "Not Assigned"}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    <span className={item.quantity <= item.min_stock ? "text-red-600" : "text-zinc-900"}>
                      {item.quantity} PCS
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    {getStatus(item) === "IN STOCK" ? (
                      <Badge className="rounded-full px-3 text-[10px] bg-emerald-500 text-white hover:bg-emerald-600 border-none font-bold uppercase tracking-wider">
                        IN STOCK
                      </Badge>
                    ) : getStatus(item) === "LOW STOCK" ? (
                      <Badge className="rounded-full px-3 text-[10px] bg-red-600 text-white hover:bg-red-700 animate-blink border-none font-bold uppercase tracking-wider">
                        LOW STOCK
                      </Badge>
                    ) : item.warehouse_id === null ? (
                      <Badge className="rounded-full px-3 text-[10px] bg-amber-100 text-amber-700 border border-amber-200 font-bold uppercase tracking-wider">
                        PENDING ASSIGNMENT
                      </Badge>
                    ) : (
                      <Badge className="rounded-full px-3 text-[10px] bg-zinc-200 text-zinc-700 hover:bg-zinc-300 border-none font-bold uppercase tracking-wider">
                        OUT OF STOCK
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-8 w-8 p-0")}>
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Inventory Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => openUpdateModal(item)} className="cursor-pointer">
                            <RefreshCw className="mr-2 h-4 w-4" /> Adjust Stock
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openTransferModal(item)} className="cursor-pointer">
                            <ArrowRightLeft className="mr-2 h-4 w-4" /> Transfer Stock
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

      <StockModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSuccess={fetchInventory}
        type={modalType}
        initialData={selectedItem}
      />
    </div>
  );
}
