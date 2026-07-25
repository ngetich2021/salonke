"use client";

import { useMemo, useState } from "react";

type Row = {
  key: string;
  searchText: string;
  cells: React.ReactNode[];
  // Plain-text/number form of each cell, column-for-column with `cells` —
  // needed because `cells` is arbitrary JSX (buttons, badges, links) that
  // can't be serialized to CSV on its own. Falls back to stringifying
  // `cells` directly when omitted, which only works for cells that are
  // already plain strings/numbers; anything else exports blank, so callers
  // whose cells contain formatted/interactive content should provide this.
  values?: (string | number | null | undefined)[];
};

function csvField(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadCsv(headers: string[], rows: Row[], filenamePrefix: string) {
  const lines = [
    headers.map(csvField).join(","),
    ...rows.map((row) =>
      (row.values ?? row.cells.map((c) => (typeof c === "string" || typeof c === "number" ? c : "")))
        .map(csvField)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Visible rows before the table's own scrollbar kicks in — a fixed-height
// window (not page-by-page clicking) so long tables never depend on
// scrolling the whole page, and the header stays pinned in view instead of
// scrolling away above the fold (see AGENTS.md task: sticky ad player at
// the top was pushing table headers out of sight).
const VISIBLE_ROWS = 5;
const ROW_HEIGHT_PX = 41;
const HEADER_HEIGHT_PX = 33;
const DEFAULT_STICKY_WIDTH_PX = 110;

// z-index budget for the frozen-header + frozen-leading-columns combo below.
// Kept well under the app-level sticky bars (the ad player strip is z-40,
// the site header z-50) so a table's own "stationary" cells never fight
// with — or accidentally sit above — the global chrome around it.
const Z_BODY_STICKY_COL = 10;
const Z_HEADER_ROW = 20;
const Z_HEADER_STICKY_COL = 30;

export function DataTable({
  headers,
  rows,
  searchPlaceholder = "Search…",
  emptyText = "No results.",
  stickyColumns = 1,
  stickyColumnWidths,
  exportFilename = "table",
}: {
  headers: string[];
  rows: Row[];
  searchPlaceholder?: string;
  emptyText?: string;
  // How many leading columns (e.g. an ID + a name) stay put — pinned to the
  // left edge — while the rest of a wide row scrolls horizontally under
  // them, so the identifying data for a row is never scrolled out of view
  // while acting on it further right (e.g. a "Cancel" button).
  stickyColumns?: number;
  // Pixel width for each sticky column, left to right. Freezing a column
  // requires a fixed width (its neighbor's `left` offset depends on it);
  // any column beyond this array falls back to DEFAULT_STICKY_WIDTH_PX.
  stickyColumnWidths?: number[];
  // Base name for the downloaded CSV file (a date is appended) — every
  // table gets the download button for free, callers only need to name it.
  exportFilename?: string;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => row.searchText.toLowerCase().includes(q));
  }, [rows, query]);

  const scrollable = filtered.length > VISIBLE_ROWS;
  const maxHeightPx = HEADER_HEIGHT_PX + VISIBLE_ROWS * ROW_HEIGHT_PX;

  function widthOf(colIndex: number) {
    return stickyColumnWidths?.[colIndex] ?? DEFAULT_STICKY_WIDTH_PX;
  }
  function leftOf(colIndex: number) {
    let left = 0;
    for (let i = 0; i < colIndex; i++) left += widthOf(i);
    return left;
  }
  // Header cells need both a top offset (they already sit inside the
  // sticky `<thead>` below, which handles that) and a left offset of their
  // own — plus the highest z-index of the four cell kinds, since a frozen
  // header cell must stay above both plain header cells sliding past
  // beneath it AND the frozen body cells in the column below it.
  function headerCellStyle(colIndex: number): React.CSSProperties | undefined {
    if (colIndex >= stickyColumns) return undefined;
    const width = widthOf(colIndex);
    return {
      position: "sticky",
      left: leftOf(colIndex),
      width,
      minWidth: width,
      maxWidth: width,
      zIndex: Z_HEADER_STICKY_COL,
    };
  }
  function bodyCellStyle(colIndex: number): React.CSSProperties | undefined {
    if (colIndex >= stickyColumns) return undefined;
    const width = widthOf(colIndex);
    return {
      position: "sticky",
      left: leftOf(colIndex),
      width,
      minWidth: width,
      maxWidth: width,
      zIndex: Z_BODY_STICKY_COL,
    };
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="min-w-0 flex-1 rounded-full border border-black/[.08] px-4 py-2 text-sm dark:border-white/[.145] dark:bg-transparent"
          />
          <button
            type="button"
            onClick={() => downloadCsv(headers, filtered, exportFilename)}
            className="shrink-0 rounded-full border border-black/[.08] px-4 py-2 text-xs font-medium whitespace-nowrap dark:border-white/[.145]"
          >
            ⬇ Download CSV
          </button>
        </div>
      )}
      {filtered.length === 0 ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{emptyText}</p>
      ) : (
        <div className="flex flex-col gap-1">
          <div
            className="relative z-0 overflow-x-auto overflow-y-auto rounded-lg border border-black/[.08] dark:border-white/[.145]"
            style={scrollable ? { maxHeight: `${maxHeightPx}px` } : undefined}
          >
            <table className="w-full text-left text-sm">
              <thead
                className="sticky top-0 bg-white dark:bg-zinc-900"
                style={{ zIndex: Z_HEADER_ROW }}
              >
                <tr className="border-b border-black/[.08] text-xs text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
                  {headers.map((header, i) => (
                    <th
                      key={header}
                      style={headerCellStyle(i)}
                      className={`whitespace-nowrap px-3 py-2 font-medium ${
                        i < stickyColumns ? "bg-white dark:bg-zinc-900" : ""
                      }`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr
                    key={row.key}
                    className="border-b border-black/[.08] last:border-0 dark:border-white/[.145]"
                  >
                    {row.cells.map((cell, i) => (
                      <td
                        key={i}
                        style={bodyCellStyle(i)}
                        className={`px-3 py-2 align-top ${
                          i < stickyColumns ? "bg-white dark:bg-zinc-900" : ""
                        }`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {scrollable && (
            <p className="text-right text-xs text-zinc-500 dark:text-zinc-400">
              Showing {VISIBLE_ROWS} of {filtered.length} — scroll for more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
