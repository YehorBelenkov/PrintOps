import React from 'react';

export interface WidgetProps {
  title: string;
  compact?: boolean;
  data?: import('@/lib/data/dataset').PanelData;
}

const Head = ({ title }: { title: string }) => (
  <h3 className="text-sm font-semibold tracking-wide uppercase opacity-70 mb-3">
    {title}
  </h3>
);

const Row = ({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) => (
  <div className="flex justify-between items-baseline gap-3">
    <span className="text-sm opacity-60 truncate">{label}</span>
    <span className={`text-sm font-semibold whitespace-nowrap ${tone ?? ''}`}>
      {value}
    </span>
  </div>
);

const Bar = ({ pct, color }: { pct: number; color: string }) => (
  <div className="h-1.5 w-full rounded-full bg-current/10 overflow-hidden">
    <div
      className="h-full rounded-full transition-all"
      style={{ width: `${pct}%`, backgroundColor: color }}
    />
  </div>
);

export function ProductionWidget({ title, compact }: WidgetProps) {
  const jobs = [
    { id: '#1042', name: 'ABC Trucking — 500 die-cut', pct: 80 },
    { id: '#1041', name: 'Mobile Auto — window decals', pct: 45 },
    { id: '#1040', name: 'Gulf Signs — banner 4x8', pct: 20 },
  ];
  return (
    <>
      <Head title={title} />
      <div className="flex gap-6 mb-4">
        <div>
          <div className="text-3xl font-bold">6</div>
          <div className="text-xs opacity-60">Printing</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-emerald-500">12</div>
          <div className="text-xs opacity-60">Done today</div>
        </div>
        <div>
          <div className="text-3xl font-bold text-amber-500">8</div>
          <div className="text-xs opacity-60">Queued</div>
        </div>
      </div>
      {!compact && (
        <div className="space-y-3">
          {jobs.map((j) => (
            <div key={j.id} className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-medium">{j.id}</span>
                <span className="opacity-60 truncate ml-2">{j.name}</span>
              </div>
              <Bar pct={j.pct} color="var(--accent-color)" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export function ActiveOrdersWidget({ title, compact }: WidgetProps) {
  const orders = [
    { id: '#1042', customer: 'ABC Trucking', status: 'In Production', tone: 'text-blue-500' },
    { id: '#1041', customer: 'Mobile Auto Spa', status: 'Cutting', tone: 'text-violet-500' },
    { id: '#1040', customer: 'Gulf Coast Signs', status: 'Laminating', tone: 'text-amber-500' },
    { id: '#1039', customer: 'Riverside Cafe', status: 'Weeding', tone: 'text-emerald-500' },
  ];
  return (
    <>
      <Head title={title} />
      <div className="space-y-2.5">
        {orders.slice(0, compact ? 2 : 4).map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{o.customer}</div>
              <div className="text-xs opacity-50">{o.id}</div>
            </div>
            <span className={`text-xs font-medium whitespace-nowrap ${o.tone}`}>
              {o.status}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

export function PendingQuotesWidget({ title, compact }: WidgetProps) {
  const quotes = [
    { customer: 'Northside Gym', amount: '$1,240.00' },
    { customer: 'Taco Junction', amount: '$684.50' },
    { customer: 'Harbor Marina', amount: '$560.00' },
  ];
  return (
    <>
      <Head title={title} />
      <div className="space-y-2.5">
        {quotes.slice(0, compact ? 2 : 3).map((q) => (
          <Row key={q.customer} label={q.customer} value={q.amount} />
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-current/10">
        <Row label="Total outstanding" value="$2,484.50" tone="text-base" />
      </div>
    </>
  );
}

export function MaterialStockWidget({ title, compact }: WidgetProps) {
  const rolls = [
    { name: 'White gloss vinyl', pct: 72, color: '#22c55e' },
    { name: 'Matte laminate', pct: 38, color: '#f59e0b' },
    { name: 'Clear transfer tape', pct: 12, color: '#ef4444' },
    { name: 'Reflective silver', pct: 88, color: '#22c55e' },
  ];
  return (
    <>
      <Head title={title} />
      <div className="space-y-3">
        {rolls.slice(0, compact ? 2 : 4).map((r) => (
          <div key={r.name} className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="truncate">{r.name}</span>
              <span className="opacity-60 ml-2">{r.pct}%</span>
            </div>
            <Bar pct={r.pct} color={r.color} />
          </div>
        ))}
      </div>
    </>
  );
}

export function ProofApprovalsWidget({ title, compact }: WidgetProps) {
  const proofs = [
    { customer: 'Northside Gym', waiting: '2 days' },
    { customer: 'Taco Junction', waiting: '6 hours' },
    { customer: 'Blue Ridge Tours', waiting: '4 days' },
  ];
  return (
    <>
      <Head title={title} />
      <div className="space-y-2.5">
        {proofs.slice(0, compact ? 2 : 3).map((p) => (
          <div key={p.customer} className="flex items-center gap-2.5">
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--accent-color)' }}
            />
            <span className="text-sm truncate flex-1">{p.customer}</span>
            <span className="text-xs opacity-50 whitespace-nowrap">{p.waiting}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function RevenueWidget({ title, compact }: WidgetProps) {
  return (
    <>
      <Head title={title} />
      <div className="text-3xl font-bold">$18,420</div>
      <div className="text-xs text-emerald-500 mb-3">▲ 12.4% vs last month</div>
      {!compact && (
        <div className="space-y-2 pt-3 border-t border-current/10">
          <Row label="Stickers" value="$9,110" />
          <Row label="Vehicle wraps" value="$6,240" />
          <Row label="Signage" value="$3,070" />
        </div>
      )}
    </>
  );
}

export function ShippingWidget({ title, compact }: WidgetProps) {
  const shipments = [
    { id: '#1038', carrier: 'UPS Ground' },
    { id: '#1037', carrier: 'USPS Priority' },
    { id: '#1035', carrier: 'Local pickup' },
  ];
  return (
    <>
      <Head title={title} />
      <div className="text-3xl font-bold mb-3">3</div>
      {!compact && (
        <div className="space-y-2">
          {shipments.map((s) => (
            <Row key={s.id} label={s.id} value={s.carrier} />
          ))}
        </div>
      )}
    </>
  );
}

export function DesignGalleryWidget({ title, compact }: WidgetProps) {
  const designs = [
    { name: 'Mountain badge', from: '#6366f1', to: '#a855f7' },
    { name: 'Retro wave', from: '#f43f5e', to: '#fb923c' },
    { name: 'Coffee cup', from: '#78350f', to: '#d97706' },
    { name: 'Surf script', from: '#0891b2', to: '#22d3ee' },
    { name: 'Neon cat', from: '#db2777', to: '#8b5cf6' },
    { name: 'Pine ridge', from: '#065f46', to: '#34d399' },
  ];
  return (
    <>
      <Head title={title} />
      <div className={`grid gap-2.5 ${compact ? 'grid-cols-3' : 'grid-cols-3 sm:grid-cols-6'}`}>
        {designs.slice(0, compact ? 3 : 6).map((d) => (
          <div key={d.name} className="space-y-1.5">
            <div
              className="aspect-square rounded-lg"
              style={{ background: `linear-gradient(135deg, ${d.from}, ${d.to})` }}
            />
            <div className="text-[10px] opacity-60 truncate">{d.name}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function MachineStatusWidget({ title, compact }: WidgetProps) {
  const machines = [
    { name: 'Roland TrueVIS', state: 'Printing', tone: 'bg-emerald-500' },
    { name: 'Graphtec CE7000', state: 'Idle', tone: 'bg-slate-400' },
    { name: 'Laminator', state: 'Needs media', tone: 'bg-amber-500' },
  ];
  return (
    <>
      <Head title={title} />
      <div className="space-y-2.5">
        {machines.slice(0, compact ? 2 : 3).map((m) => (
          <div key={m.name} className="flex items-center gap-2.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${m.tone}`} />
            <span className="text-sm truncate flex-1">{m.name}</span>
            <span className="text-xs opacity-50 whitespace-nowrap">{m.state}</span>
          </div>
        ))}
      </div>
    </>
  );
}

export function NotesWidget({ title }: WidgetProps) {
  return (
    <>
      <Head title={title} />
      <ul className="space-y-2 text-sm opacity-80">
        <li>• Reorder clear transfer tape — down to 12%</li>
        <li>• Gulf Coast wants matte, not gloss</li>
        <li>• Cutter blade due for swap Friday</li>
      </ul>
    </>
  );
}
