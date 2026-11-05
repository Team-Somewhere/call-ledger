import React, { ReactNode } from "react";
import { cn } from "../lib/utils";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T) => ReactNode;
  className?: string;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  emptyMessage = "No records found.",
  className,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="p-8 text-center text-xs font-mono text-[#78716C] bg-[#FFF2DB]/40 rounded-sm border border-[#E8DFD1]">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-x-auto rounded-sm border border-[#E8DFD1] bg-[#FFFAF3]",
        className,
      )}
    >
      <table className="w-full text-left text-xs text-[#171717]">
        <thead className="bg-[#FFF2DB]/70 text-[#78716C] border-b border-[#E8DFD1] uppercase tracking-wider text-[10px] font-mono">
          <tr>
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={cn("px-4 py-2.5 font-medium", col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E8DFD1] font-mono">
          {data.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className="hover:bg-[#FFF2DB]/50 transition-colors"
            >
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className={cn("px-4 py-3 whitespace-nowrap", col.className)}
                >
                  {col.cell
                    ? col.cell(row)
                    : col.accessorKey
                      ? String(row[col.accessorKey] ?? "-")
                      : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
