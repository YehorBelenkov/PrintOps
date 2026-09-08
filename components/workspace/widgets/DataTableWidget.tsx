import React from 'react';
import { Column, PanelData, Row, queryTable } from '@/lib/data/dataset';

const STATUS_TONE: Record<string, string> = {
  'In Production': 'text-blue-500',
  Cutting: 'text-violet-500',
  Laminating: 'text-amber-500',
  Weeding: 'text-emerald-500',
  Ready: 'text-emerald-500',
  Shipped: 'text-slate-400',
  Sent: 'text-blue-500',
  Viewed: 'text-violet-500',
  Negotiating: 'text-amber-500',
  Accepted: 'text-emerald-500',
  Declined: 'text-rose-500',
  Queued: 'text-slate-400',
  Printing: 'text-blue-500',
  Finishing: 'text-amber-500',
  QC: 'text-violet-500',
};

function Cell({ column, value }: { column: Column; value: Row[string] }) {
  switch (column.type) {
    case 'money':
      return <span className="tabular-nums">${Number(value).toLocaleString()}</span>;
    case 'number':
      return <span className="tabular-nums">{Number(value).toLocaleString()}</span>;
    case 'percent':
      return (
        <span className="flex items-center gap-2">
          <span className="tabular-nums w-8">{value}%</span>
          <span className="h-1 w-12 rounded-full bg-current/15 overflow-hidden">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.min(100, Number(value))}%`,
                backgroundColor: 'var(--accent-color)',
              }}
            />
          </span>
        </span>
      );
    case 'status':
      return (
        <span className={`font-medium ${STATUS_TONE[String(value)] ?? ''}`}>{value}</span>
      );
    default:
      return <span>{value}</span>;
  }
}

export function DataTableWidget({
  title,
  data,
  compact,
}: {
  title: string;
  data?: PanelData;
  compact?: boolean;
}) {
  if (!data) {
    return (
      <>
        <h3 className="text-sm font-semibold tracking-wide uppercase opacity-70 mb-3">{title}</h3>
        <p className="text-sm opacity-50">No table selected.</p>
      </>
    );
  }

  const { columns, rows } = queryTable(data);
  const shown = compact ? columns.slice(0, 3) : columns;

  return (
    <>
      <div className="flex items-baseline justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold tracking-wide uppercase opacity-70">{title}</h3>
        <span className="text-[10px] opacity-40 whitespace-nowrap">
          {data.table}
          {data.filterValue ? ` · ${data.filterValue}` : ''}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm opacity-50">No matching rows.</p>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left">
                {shown.map((c) => (
                  <th
                    key={c.key}
                    className="px-1 pb-2 text-[10px] uppercase tracking-wide opacity-50 font-medium whitespace-nowrap"
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-current/10">
                  {shown.map((c) => (
                    <td key={c.key} className="px-1 py-1.5 whitespace-nowrap">
                      <Cell column={c} value={row[c.key]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
