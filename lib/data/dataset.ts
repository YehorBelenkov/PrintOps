/**
 * Mock shop data. Generated from a fixed seed so the server and the client
 * produce identical rows and hydration stays stable.
 */

export type ColumnType = 'text' | 'number' | 'money' | 'percent' | 'date' | 'status';

export interface Column {
  key: string;
  label: string;
  type: ColumnType;
}

export interface TableSchema {
  name: string;
  label: string;
  description: string;
  columns: Column[];
}

export type Row = Record<string, string | number>;

export interface PanelData {
  table: string;
  columns?: string[];
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filterColumn?: string;
  filterValue?: string;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(20260907);
const pick = <T,>(items: T[]): T => items[Math.floor(rng() * items.length)];
const int = (min: number, max: number) => Math.floor(min + rng() * (max - min + 1));
const money = (min: number, max: number) => Math.round((min + rng() * (max - min)) * 100) / 100;

const day = (offset: number) => {
  const d = new Date(Date.UTC(2026, 8, 7));
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

const COMPANIES = [
  'ABC Trucking', 'Mobile Auto Spa', 'Gulf Coast Signs', 'Riverside Cafe', 'Northside Gym',
  'Taco Junction', 'Harbor Marina', 'Blue Ridge Tours', 'Peak Roofing', 'Lakeside Dental',
  'Iron Forge Barbell', 'Sunset Landscaping', 'Copper Kettle Brewing', 'Vista Realty',
  'Cascade Plumbing', 'Nine Lives Pet Care', 'Foxglove Florist', 'Summit Auto Glass',
  'Driftwood Surf Co', 'Union Street Bakery', 'Redline Motorsports', 'Cedar Park Church',
  'Anchor Coffee', 'Bright Path Academy',
];

const CITIES = ['Austin', 'Round Rock', 'Cedar Park', 'Georgetown', 'Pflugerville', 'Leander'];
const PRODUCTS = [
  'Die-cut stickers', 'Vehicle decals', 'Window graphics', 'Banner 4x8', 'Yard signs',
  'Vinyl lettering', 'Laminated labels', 'Magnetic signs', 'Floor graphics', 'Wall mural',
];
const ORDER_STATUS = ['In Production', 'Cutting', 'Laminating', 'Weeding', 'Ready', 'Shipped'];
const QUOTE_STATUS = ['Sent', 'Viewed', 'Negotiating', 'Accepted', 'Declined'];
const MACHINES = ['Roland TrueVIS', 'Graphtec CE7000', 'Laminator', 'Summa F1612', 'HP Latex 335'];
const STAGES = ['Queued', 'Printing', 'Cutting', 'Finishing', 'QC'];
const OPERATORS = ['Marta', 'Devon', 'Priya', 'Luis', 'Ann'];
const MATERIAL_TYPES = ['Vinyl', 'Laminate', 'Transfer tape', 'Substrate', 'Ink'];
const SUPPLIERS = ['Grimco', 'Fellers', 'ORAFOL', 'Avery Dennison'];

const customers: Row[] = COMPANIES.map((name, i) => ({
  id: `C-${1000 + i}`,
  name,
  city: pick(CITIES),
  since: day(-int(90, 1400)),
  orders: int(1, 34),
  lifetimeValue: money(480, 42000),
}));

const orders: Row[] = Array.from({ length: 40 }, (_, i) => {
  const customer = pick(customers);
  const qty = int(25, 2000);
  return {
    id: `#${1000 + i}`,
    customer: customer.name as string,
    product: pick(PRODUCTS),
    qty,
    status: pick(ORDER_STATUS),
    due: day(int(-4, 21)),
    total: money(85, 6400),
  };
});

const quotes: Row[] = Array.from({ length: 18 }, (_, i) => ({
  id: `Q-${500 + i}`,
  customer: (pick(customers).name as string),
  description: pick(PRODUCTS),
  amount: money(120, 9800),
  status: pick(QUOTE_STATUS),
  sent: day(-int(1, 40)),
}));

const materials: Row[] = [
  'White gloss vinyl', 'Matte laminate', 'Clear transfer tape', 'Reflective silver',
  'Cast wrap vinyl', 'Perforated window film', 'Coroplast 4mm', 'Aluminium composite',
  'Eco-solvent ink CMYK', 'Gloss overlaminate', 'Frosted etch film', 'Magnetic sheet',
].map((name, i) => ({
  id: `M-${100 + i}`,
  name,
  type: pick(MATERIAL_TYPES),
  stock: int(4, 98),
  supplier: pick(SUPPLIERS),
  reorderAt: int(15, 35),
}));

const jobs: Row[] = Array.from({ length: 20 }, (_, i) => {
  const order = pick(orders);
  return {
    id: `J-${300 + i}`,
    order: order.id as string,
    machine: pick(MACHINES),
    stage: pick(STAGES),
    progress: int(0, 100),
    operator: pick(OPERATORS),
  };
});

export const TABLES: Record<string, TableSchema> = {
  customers: {
    name: 'customers',
    label: 'Customers',
    description: 'shop accounts with spend history',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'name', label: 'Customer', type: 'text' },
      { key: 'city', label: 'City', type: 'text' },
      { key: 'since', label: 'Since', type: 'date' },
      { key: 'orders', label: 'Orders', type: 'number' },
      { key: 'lifetimeValue', label: 'Lifetime value', type: 'money' },
    ],
  },
  orders: {
    name: 'orders',
    label: 'Orders',
    description: 'jobs booked in, with status and due date',
    columns: [
      { key: 'id', label: 'Order', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'product', label: 'Product', type: 'text' },
      { key: 'qty', label: 'Qty', type: 'number' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'due', label: 'Due', type: 'date' },
      { key: 'total', label: 'Total', type: 'money' },
    ],
  },
  quotes: {
    name: 'quotes',
    label: 'Quotes',
    description: 'estimates sent and awaiting a decision',
    columns: [
      { key: 'id', label: 'Quote', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'text' },
      { key: 'description', label: 'For', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'money' },
      { key: 'status', label: 'Status', type: 'status' },
      { key: 'sent', label: 'Sent', type: 'date' },
    ],
  },
  materials: {
    name: 'materials',
    label: 'Materials',
    description: 'vinyl, laminate and ink stock levels',
    columns: [
      { key: 'id', label: 'ID', type: 'text' },
      { key: 'name', label: 'Material', type: 'text' },
      { key: 'type', label: 'Type', type: 'text' },
      { key: 'stock', label: 'Stock', type: 'percent' },
      { key: 'supplier', label: 'Supplier', type: 'text' },
      { key: 'reorderAt', label: 'Reorder at', type: 'percent' },
    ],
  },
  jobs: {
    name: 'jobs',
    label: 'Production jobs',
    description: 'what each machine is running right now',
    columns: [
      { key: 'id', label: 'Job', type: 'text' },
      { key: 'order', label: 'Order', type: 'text' },
      { key: 'machine', label: 'Machine', type: 'text' },
      { key: 'stage', label: 'Stage', type: 'status' },
      { key: 'progress', label: 'Progress', type: 'percent' },
      { key: 'operator', label: 'Operator', type: 'text' },
    ],
  },
};

export const DATA: Record<string, Row[]> = { customers, orders, quotes, materials, jobs };

export const TABLE_NAMES = Object.keys(TABLES);

/** One compact line per table, for the agent prompt. */
export function describeTables(): string {
  return TABLE_NAMES.map((name) => {
    const t = TABLES[name];
    const cols = t.columns.map((c) => c.key).join(', ');
    return `  ${name} (${DATA[name].length} rows) — ${t.description}: ${cols}`;
  }).join('\n');
}

export function sanitizePanelData(input: unknown): PanelData | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const table = String(raw.table ?? '').trim();
  if (!TABLES[table]) return undefined;

  const valid = new Set(TABLES[table].columns.map((c) => c.key));
  const columns = Array.isArray(raw.columns)
    ? (raw.columns as unknown[]).filter((c): c is string => typeof c === 'string' && valid.has(c))
    : undefined;

  const sortBy = typeof raw.sortBy === 'string' && valid.has(raw.sortBy) ? raw.sortBy : undefined;
  const filterColumn =
    typeof raw.filterColumn === 'string' && valid.has(raw.filterColumn)
      ? raw.filterColumn
      : undefined;

  return {
    table,
    columns: columns?.length ? columns : undefined,
    limit: typeof raw.limit === 'number' ? Math.min(50, Math.max(1, Math.round(raw.limit))) : undefined,
    sortBy,
    sortDir: raw.sortDir === 'asc' || raw.sortDir === 'desc' ? raw.sortDir : undefined,
    filterColumn,
    filterValue:
      filterColumn && typeof raw.filterValue === 'string'
        ? raw.filterValue.trim().slice(0, 60)
        : undefined,
  };
}

export function queryTable(config: PanelData): { columns: Column[]; rows: Row[] } {
  const schema = TABLES[config.table];
  if (!schema) return { columns: [], rows: [] };

  let rows = [...(DATA[config.table] ?? [])];

  if (config.filterColumn && config.filterValue) {
    const needle = config.filterValue.toLowerCase();
    rows = rows.filter((r) => String(r[config.filterColumn!]).toLowerCase().includes(needle));
  }

  if (config.sortBy) {
    const dir = config.sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const x = a[config.sortBy!];
      const y = b[config.sortBy!];
      if (typeof x === 'number' && typeof y === 'number') return (x - y) * dir;
      return String(x).localeCompare(String(y)) * dir;
    });
  }

  const columns = config.columns?.length
    ? config.columns
        .map((key) => schema.columns.find((c) => c.key === key))
        .filter((c): c is Column => Boolean(c))
    : schema.columns;

  return { columns, rows: rows.slice(0, config.limit ?? 8) };
}
