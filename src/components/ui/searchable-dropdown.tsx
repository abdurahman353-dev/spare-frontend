"use client";

import * as React from "react";
import { Check, Plus, Trash2, Loader2, Search, ChevronDown, Edit2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Item {
  id: string | number;
  name: string;
  flagCode?: string;
}

interface SearchableDropdownProps {
  items: Item[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onAdd?: (name: string) => Promise<void>;
  onDelete?: (id: string | number) => Promise<void>;
  onEdit?: (id: string | number, newName: string) => Promise<void>;
  className?: string;
  disabled?: boolean;
}

export function SearchableDropdown({
  items,
  value,
  onChange,
  placeholder,
  onAdd,
  onDelete,
  onEdit,
  className,
  disabled,
}: SearchableDropdownProps): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | number | null>(null);
  const [editingId, setEditingId] = React.useState<string | number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = React.useState<string | number | null>(null);
  const [editModalData, setEditModalData] = React.useState<{ id: string | number; name: string } | null>(null);
  const [editInputValue, setEditInputValue] = React.useState("");

  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Close when clicking outside
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus input when opened
  React.useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setSearch("");
    }
  }, [open]);

  // Memoize filtered items to prevent unnecessary re-renders
  const filtered = React.useMemo(() => {
    const searchLower = search.toLowerCase();
    return items.filter((item) =>
      item.name.toLowerCase().includes(searchLower)
    );
  }, [items, search]);

  // Memoize exact match check
  const exactMatch = React.useMemo(() => {
    const searchLower = search.toLowerCase();
    return items.some((item) => item.name.toLowerCase() === searchLower);
  }, [items, search]);

  // Memoize selected item
  const selectedItem = React.useMemo(() => {
    return items.find((item) => item.id.toString() === value);
  }, [items, value]);

  // Memoize event handlers to prevent unnecessary re-renders
  const handleSelect = React.useCallback((item: Item) => {
    onChange(item.id.toString());
    setOpen(false);
  }, [onChange]);

  const handleAdd = React.useCallback(async () => {
    if (!onAdd || !search.trim() || exactMatch) return;
    setAdding(true);
    try {
      await onAdd(search.trim());
      setSearch("");
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  }, [onAdd, search, exactMatch]);

  const handleDeleteClick = React.useCallback((e: React.MouseEvent, id: string | number) => {
    e.stopPropagation();
    if (!onDelete) return;
    setDeleteConfirmId(id);
    setOpen(false);
  }, [onDelete]);

  const confirmDelete = React.useCallback(async () => {
    if (!onDelete || !deleteConfirmId) return;
    setDeletingId(deleteConfirmId);
    try {
      await onDelete(deleteConfirmId);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
      setDeleteConfirmId(null);
    }
  }, [onDelete, deleteConfirmId]);

  const handleEditClick = React.useCallback((e: React.MouseEvent, id: string | number, currentName: string) => {
    e.stopPropagation();
    if (!onEdit) return;
    setEditModalData({ id, name: currentName });
    setEditInputValue(currentName);
    setOpen(false);
  }, [onEdit]);

  const confirmEdit = React.useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onEdit || !editModalData) return;
    const newName = editInputValue.trim();
    if (!newName || newName === editModalData.name) {
      setEditModalData(null);
      return;
    }
    setEditingId(editModalData.id);
    try {
      await onEdit(editModalData.id, newName);
    } catch (err) {
      console.error(err);
    } finally {
      setEditingId(null);
      setEditModalData(null);
    }
  }, [onEdit, editModalData, editInputValue]);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-left shadow-sm transition-all",
          "hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/20",
          open && "border-primary ring-2 ring-primary/20",
          disabled && "opacity-50 cursor-not-allowed",
          className
        )}
      >
        <span className={cn(selectedItem ? "text-zinc-900 font-medium" : "text-zinc-400", "flex items-center gap-2")}>
          {selectedItem?.flagCode && (
            <img
              src={`https://flagcdn.com/w40/${selectedItem.flagCode.toLowerCase()}.png`}
              className="w-5 h-3.5 object-cover rounded-xs border border-zinc-200 shrink-0"
              alt=""
            />
          )}
          {selectedItem ? selectedItem.name : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute z-50 mt-1 left-0 right-0 md:right-auto min-w-full md:w-max max-w-full md:max-w-[400px] rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
          {/* Search Input */}
          <div className="flex items-center border-b border-zinc-100 px-3 py-2 gap-2">
            <Search className="h-4 w-4 text-zinc-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${placeholder.toLowerCase()}...`}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filtered.length === 1) {
                    handleSelect(filtered[0]);
                  } else if (search && !exactMatch) {
                    handleAdd();
                  }
                }
                if (e.key === "Escape") setOpen(false);
              }}
            />
          </div>

          {/* List - max 5 items visible, scrollable */}
          <div className="overflow-y-auto overflow-x-hidden custom-scrollbar w-full min-w-full block" style={{ maxHeight: "200px" }}>
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-zinc-400 text-center">
                No results found
              </div>
            ) : (
              filtered.slice(0, 100).map((item) => (
                <div
                  key={item.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(item);
                  }}
                  className={cn(
                    "flex items-center justify-between pl-3 pr-4 py-2.5 cursor-pointer group transition-colors",
                    "hover:bg-primary/5",
                    value === item.id.toString() && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <Check
                      className={cn(
                        "h-3.5 w-3.5 text-primary flex-shrink-0",
                        value === item.id.toString() ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {item.flagCode && (
                      <img
                        src={`https://flagcdn.com/w40/${item.flagCode.toLowerCase()}.png`}
                        className="w-5 h-3.5 object-cover rounded-xs border border-zinc-200 shrink-0"
                        alt=""
                      />
                    )}
                    <span className="text-sm font-medium text-zinc-800 whitespace-nowrap">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {onEdit && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleEditClick(e, item.id, item.name);
                        }}
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-md hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-all"
                        title="Edit"
                      >
                        {editingId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Edit2 className="h-3 w-3" />
                        )}
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleDeleteClick(e, item.id);
                        }}
                        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-md hover:bg-red-50 hover:text-red-600 text-zinc-400 transition-all"
                        title="Delete"
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add New Item */}
          {onAdd && search.trim() && !exactMatch && (
            <div className="border-t border-zinc-100 p-2">
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleAdd();
                }}
                disabled={adding}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm font-bold text-primary hover:bg-primary/5 rounded-lg transition-colors disabled:opacity-50"
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Add &quot;{search.trim()}&quot;
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <DialogContent className="sm:max-w-[400px] bg-white rounded-xl shadow-lg border border-zinc-200">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-red-50 text-red-600 rounded-full flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-xl font-bold text-zinc-900">Confirm Deletion</DialogTitle>
            </div>
            <DialogDescription className="text-zinc-500 pt-3">
              Are you sure you want to permanently delete{" "}
              <strong className="text-zinc-900">{items.find((i) => i.id === deleteConfirmId)?.name}</strong>?{" "}
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 flex gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} className="rounded-lg h-10 w-full sm:w-auto">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deletingId !== null}
              className="rounded-lg h-10 font-bold bg-red-600 hover:bg-red-700 text-white w-full sm:w-auto"
            >
              {deletingId !== null ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Modal */}
      <Dialog open={!!editModalData} onOpenChange={(open) => !open && setEditModalData(null)}>
        <DialogContent className="sm:max-w-[400px] bg-white rounded-xl shadow-lg border border-zinc-200">
          <form onSubmit={confirmEdit}>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
                  <Edit2 className="h-5 w-5" />
                </div>
                <DialogTitle className="text-xl font-bold text-zinc-900">Rename Item</DialogTitle>
              </div>
              <DialogDescription className="text-zinc-500 pt-2">
                Enter the new name for this item below.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Input
                value={editInputValue}
                onChange={(e) => setEditInputValue(e.target.value)}
                className="h-11 rounded-lg border-zinc-200 font-medium"
                autoFocus
              />
            </div>
            <DialogFooter className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setEditModalData(null)} className="rounded-lg h-10 w-full sm:w-auto">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={editingId !== null || !editInputValue.trim()}
                className="rounded-lg h-10 font-bold bg-primary text-white w-full sm:w-auto"
              >
                {editingId !== null ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
