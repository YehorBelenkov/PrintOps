import type { CanvasEffect, MotionLevel, PanelEffect } from '@/lib/workspace/effects';
import type { SceneConfig } from '@/lib/workspace/scene';
import type { PanelData } from '@/lib/data/dataset';

// Core workspace model: a 12-column grid of named, styleable panels.

export type WidgetType =
  | 'production'
  | 'activeOrders'
  | 'pendingQuotes'
  | 'materialStock'
  | 'proofApprovals'
  | 'revenue'
  | 'shipping'
  | 'designGallery'
  | 'machineStatus'
  | 'notes'
  | 'dataTable'
  | 'stickerLibrary';

export const WIDGET_TYPES: WidgetType[] = [
  'production',
  'activeOrders',
  'pendingQuotes',
  'materialStock',
  'proofApprovals',
  'revenue',
  'shipping',
  'designGallery',
  'machineStatus',
  'notes',
  'dataTable',
  'stickerLibrary',
];

export const WIDGET_DESCRIPTIONS: Record<WidgetType, string> = {
  production: 'print/cut queue with job counts',
  activeOrders: 'orders currently in progress',
  pendingQuotes: 'quotes awaiting customer decision',
  materialStock: 'vinyl, laminate and media roll levels',
  proofApprovals: 'design proofs waiting on customer sign-off',
  revenue: 'revenue and sales figures',
  shipping: 'packed orders ready to ship',
  designGallery: 'thumbnails of recent sticker designs',
  machineStatus: 'printer and cutter health',
  notes: 'free-form text notes',
  dataTable: 'live rows from a named database table — requires a data config',
  stickerLibrary: 'artwork the shop has generated, with a delete button on each',
};

export type ShadowLevel = 'none' | 'sm' | 'md' | 'lg';

export interface PanelStyle {
  background?: string; // hex, rgba, or 'transparent'
  borderColor?: string;
  borderWidth?: number;
  radius?: number;
  padding?: number;
  textColor?: string;
  shadow?: ShadowLevel;
  accentBar?: string; // colored strip along the top edge
  effect?: PanelEffect;
}

export interface Panel {
  id: string;
  name: string;
  widget: WidgetType;
  col: number; // 1-based start column
  colSpan: number;
  row: number; // 1-based start row
  rowSpan: number;
  style: PanelStyle;
  data?: PanelData;
}

export type Density = 'compact' | 'normal' | 'comfortable';

export interface ThemeConfig {
  mode: 'light' | 'dark';
  accent: string;
  radius: number;
  density: Density;
  background?: string; // page canvas; accepts a CSS gradient
  surface?: string; // default panel background
  border?: string;
  effect?: CanvasEffect;
  motion?: MotionLevel;
  scene?: SceneConfig | null;
}

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
}

export interface WorkspaceState {
  title: string;
  gridColumns: number;
  theme: ThemeConfig;
  navigation: NavigationItem[];
  panels: Panel[];
}

// --- Operations the agent is allowed to request ---

export interface OpSetTheme {
  op: 'setTheme';
  mode?: 'light' | 'dark';
  accent?: string;
  radius?: number;
  density?: Density;
  background?: string;
  surface?: string;
  border?: string;
}

export interface OpApplyPalette {
  op: 'applyPalette';
  palette: string;
  /** Clear per-panel backgrounds so the palette reads cleanly. Defaults to true. */
  resetPanels?: boolean;
}

export interface OpSetEffect {
  op: 'setEffect';
  effect?: CanvasEffect;
  motion?: MotionLevel;
}

export interface OpSetScene {
  op: 'setScene';
  preset?: string;
  particles?: unknown;
  bodies?: unknown;
  vignette?: number;
}

export interface OpClearScene {
  op: 'clearScene';
}

export interface OpSetTitle {
  op: 'setTitle';
  title: string;
}

export interface OpAddPanel {
  op: 'addPanel';
  name: string;
  widget: WidgetType;
  col?: number;
  colSpan?: number;
  row?: number;
  rowSpan?: number;
  style?: PanelStyle;
}

export interface OpRemovePanel {
  op: 'removePanel';
  target: string;
}

export interface OpMovePanel {
  op: 'movePanel';
  target: string;
  col?: number;
  row?: number;
}

export interface OpResizePanel {
  op: 'resizePanel';
  target: string;
  colSpan?: number;
  rowSpan?: number;
}

export interface OpStylePanel extends PanelStyle {
  op: 'stylePanel';
  target: string;
}

export interface OpRenamePanel {
  op: 'renamePanel';
  target: string;
  name: string;
}

export interface OpSetWidget {
  op: 'setWidget';
  target: string;
  widget: WidgetType;
}

export interface OpSetPanelData {
  op: 'setPanelData';
  target: string;
  table: string;
  columns?: string[];
  limit?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  filterColumn?: string;
  filterValue?: string;
}

export interface OpSwapPanels {
  op: 'swapPanels';
  target: string;
  other: string;
}

export interface OpClearPanels {
  op: 'clearPanels';
}

/** Signals that the request belongs to the Sticker Studio, not the layout editor. */
export interface OpSuggestStudio {
  op: 'suggestStudio';
  note?: string;
}

export type Operation =
  | OpSetTheme
  | OpApplyPalette
  | OpSetEffect
  | OpSetScene
  | OpClearScene
  | OpSetTitle
  | OpAddPanel
  | OpRemovePanel
  | OpMovePanel
  | OpResizePanel
  | OpStylePanel
  | OpRenamePanel
  | OpSetWidget
  | OpSetPanelData
  | OpSwapPanels
  | OpClearPanels
  | OpSuggestStudio;

export interface OperationResult {
  op: string;
  ok: boolean;
  message: string;
}

/** Colour statistics measured from a reference image in the browser. */
export interface ImageStyleAnalysis {
  mode: 'light' | 'dark';
  background: string;
  surface?: string;
  accent: string;
  palette: { hex: string; share: number }[];
  averageLuminance: number;
  averageSaturation: number;
}
