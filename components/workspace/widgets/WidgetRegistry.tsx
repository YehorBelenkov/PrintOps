import {
  ProductionWidget,
  ActiveOrdersWidget,
  PendingQuotesWidget,
  MaterialStockWidget,
  ProofApprovalsWidget,
  RevenueWidget,
  ShippingWidget,
  DesignGalleryWidget,
  MachineStatusWidget,
  NotesWidget,
  WidgetProps,
} from './shopWidgets';
import { DataTableWidget } from './DataTableWidget';
import { StickerLibraryWidget } from './StickerLibraryWidget';
import { WidgetType } from '@/types/workspace.types';

export const WidgetRegistry: Record<WidgetType, React.ComponentType<WidgetProps>> = {
  production: ProductionWidget,
  activeOrders: ActiveOrdersWidget,
  pendingQuotes: PendingQuotesWidget,
  materialStock: MaterialStockWidget,
  proofApprovals: ProofApprovalsWidget,
  revenue: RevenueWidget,
  shipping: ShippingWidget,
  designGallery: DesignGalleryWidget,
  machineStatus: MachineStatusWidget,
  notes: NotesWidget,
  dataTable: DataTableWidget,
  stickerLibrary: StickerLibraryWidget,
};

export function getWidgetComponent(type: WidgetType) {
  return WidgetRegistry[type] ?? null;
}
