import type { ReactNode } from "react";

// Every admin data table (кошельки, сотрудники, журнал, транзакции,
// диагностика) shares this exact shell — was previously hand-rolled per
// page (`overflow-x-auto rounded-xl border border-white/10` + the same
// `<thead className="bg-white/[0.04] text-neutral-400">` markup, copied
// three times with only the columns/rows changing). `scroll="y"` swaps the
// horizontal scroll for a capped-height vertical one (журнал, история) —
// pair it with a `max-h-*` in `className`.
export function Table({
  columns,
  children,
  scroll,
  className = "",
  columnWidths,
}: {
  columns: ReactNode[];
  children: ReactNode;
  scroll?: "y";
  className?: string;
  // Tailwind width classes (e.g. "w-28"), one per column, trailing columns
  // may be omitted to share the remaining space. Pass this when the rows
  // can change independently of the columns' content (filters, live data) —
  // otherwise the browser's auto layout resizes columns to fit whatever
  // rows happen to be visible, and content visibly jumps side to side.
  columnWidths?: string[];
}) {
  const overflow = scroll === "y" ? "overflow-y-auto" : "overflow-x-auto";
  return (
    <div className={`${overflow} rounded-xl border border-white/10 ${className}`}>
      <table className={`w-full text-left text-xs ${columnWidths ? "table-fixed" : ""}`}>
        {columnWidths && (
          <colgroup>
            {columns.map((_, i) => (
              <col key={i} className={columnWidths[i]} />
            ))}
          </colgroup>
        )}
        <thead className="bg-white/[0.04] text-neutral-400">
          <tr>
            {columns.map((column, i) => (
              <th key={i} className="truncate px-3 py-2">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
