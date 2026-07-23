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
}: {
  columns: ReactNode[];
  children: ReactNode;
  scroll?: "y";
  className?: string;
}) {
  const overflow = scroll === "y" ? "overflow-y-auto" : "overflow-x-auto";
  return (
    <div className={`${overflow} rounded-xl border border-white/10 ${className}`}>
      <table className="w-full text-left text-xs">
        <thead className="bg-white/[0.04] text-neutral-400">
          <tr>
            {columns.map((column, i) => (
              <th key={i} className="px-3 py-2">
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
