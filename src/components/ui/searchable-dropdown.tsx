"use client";

import * as React from "react";
import { Check, Plus, Trash2, Loader2, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Item {
  id: string | number;
  name: string;
}

interface SearchableDropdownProps {
  items: Item[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  onAdd?: (name: string) => Promise<void>;
  onDelete?: (id: string | number) => Promise<void>;
}

export function SearchableDropdown({
  items,
  value,
  onChange,
  placeholder,
  onAdd,
  onDelete,
}: SearchableDropdownProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | number | null>(null);
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

  const filtered = items.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const exactMatch = items.some(
    (item) => item.name.toLowerCase() === search.toLowerCase()
  );

  const selectedItem = items.find((item) => item.id.toString() === value);

  const handleSelect = (item: Item) => {
    onChange(item.id.toString());
    setOpen(false);
  };

  const handleAdd = async () => {
    if (!onAdd || !search.trim() || exactMatch) return;
    setAdding(true);
    try {
      await onAdd(search.trim());
      setSearch("");
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string | number) => {
    e.stopPropagation();
    if (!onDelete) return;
    if (!confirm("Delete this item permanently?")) return;
    setDeletingId(id);
    try {
      await onDelete(id);
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-left shadow-sm transition-all",
          "hover:border-zinc-300 focus:outline-none focus:ring-2 focus:ring-primary/20",
          open && "border-primary ring-2 ring-primary/20"
        )}
      >
        <span className={cn(selectedItem ? "text-zinc-900 font-medium" : "text-zinc-400")}>
          {selectedItem ? selectedItem.name : placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 text-zinc-400 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-full w-max max-w-[400px] rounded-xl border border-zinc-200 bg-white shadow-xl overflow-hidden">
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

          {/* List - max 3 items visible, scrollable */}
          <div className="overflow-y-auto overflow-x-hidden custom-scrollbar w-full min-w-full block" style={{ maxHeight: "132px" }}>
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-zinc-400 text-center">
                No results found
              </div>
            ) : (
              filtered.map((item) => (
                <div
                  key={item.id}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur
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
                    <span className="text-sm font-medium text-zinc-800 whitespace-nowrap">{item.name}</span>
                  </div>
                  {onDelete && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleDelete(e, item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 flex items-center justify-center rounded-md hover:bg-red-50 hover:text-red-600 text-zinc-400 transition-all"
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
    </div>
  );
}
