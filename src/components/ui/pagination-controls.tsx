import React from "react";
import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>> | ((page: number) => void);
  pageSize: number;
  setPageSize: React.Dispatch<React.SetStateAction<number>> | ((size: number) => void);
  totalItems: number;
  itemName?: string;
  pageSizeOptions?: number[];
}

export function PaginationControls({
  currentPage,
  setCurrentPage,
  pageSize,
  setPageSize,
  totalItems,
  itemName = "parts",
  pageSizeOptions = [15, 30, 50, 100],
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  
  // Guard against out of bounds
  if (currentPage > totalPages && totalItems > 0) {
    setCurrentPage(totalPages);
  }

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  const handlePageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val === "") {
      (setCurrentPage as any)("");
      return;
    }
    const num = Number(val);
    if (num >= 1 && num <= totalPages) {
      setCurrentPage(num);
    }
  };

  const handlePageInputBlur = () => {
    if (!currentPage || (currentPage as unknown as number) < 1) {
      setCurrentPage(1);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-white border border-[#e2e8f0] rounded-xl shadow-xs mt-4">
      <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
        Showing <span className="text-zinc-900 font-black">{totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}</span> to <span className="text-zinc-900 font-black">{Math.min(totalItems, currentPage * pageSize)}</span> of <span className="text-zinc-900 font-black">{totalItems}</span> {itemName}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="h-9 px-2 border border-zinc-200 rounded-lg text-xs font-semibold bg-white outline-none text-zinc-600 focus:ring-2 focus:ring-primary/20"
          value={pageSize}
          onChange={handlePageSizeChange}
        >
          {pageSizeOptions.map(option => (
            <option key={option} value={option}>Show {option}</option>
          ))}
        </select>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1 || totalItems === 0}
            className="h-9 w-9 p-0 rounded-lg font-bold border-zinc-200 text-zinc-600"
          >
            «
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || totalItems === 0}
            className="h-9 px-2.5 rounded-lg font-bold border-zinc-200 text-zinc-600 text-xs uppercase"
          >
            Prev
          </Button>

          <div className="flex items-center gap-1.5 px-2">
            <span className="text-xs text-zinc-400 font-bold uppercase">Page</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage || ""}
              onChange={handlePageInputChange}
              onBlur={handlePageInputBlur}
              className="w-12 h-9 px-1 text-center border border-zinc-200 rounded-lg text-xs font-black bg-white text-zinc-800 outline-none focus:ring-2 focus:ring-primary/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-xs text-zinc-400 font-bold uppercase">of {totalPages}</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || totalItems === 0}
            className="h-9 px-2.5 rounded-lg font-bold border-zinc-200 text-zinc-600 text-xs uppercase"
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages || totalItems === 0}
            className="h-9 w-9 p-0 rounded-lg font-bold border-zinc-200 text-zinc-600"
          >
            »
          </Button>
        </div>
      </div>
    </div>
  );
}
