/**
 * Ops work-order inbox.
 * Waiting time is the recorded snapshot, not a live clock.
 * Status and assignee changes stay in this session.
 */

import { adminUsers } from '@/data/admin';

export type WorkOrderSource = 'agent' | 'workflow';
export type WorkOrderStatus = 'open' | 'in_progress' | 'resolved';
export type WorkOrderType = 'incident' | 'approval' | 'email' | 'complaint';

export const WORK_ORDER_TYPES = [
  'incident',
  'approval',
  'email',
  'complaint',
] as const satisfies readonly WorkOrderType[];

export type WorkOrderCopy = {
  zh: string;
  en: string;
};

export type WorkOrder = {
  id: string;
  /** Absent when the inbox item did not name an origin. */
  source?: WorkOrderSource;
  type: WorkOrderType;
  summary: WorkOrderCopy;
  /** Workspace / env label. Same in both locales. */
  scope: string;
  /** Recorded wait at seed time. Absent when it was not recorded. */
  waiting?: string;
  /** Present only when the source item named a severity. */
  priority?: 'sev2';
  status: WorkOrderStatus;
  /**
   * `local` is the console user. Otherwise an active admin user id.
   * Absent until claimed or assigned.
   */
  assigneeId?: string;
};

export const LOCAL_ASSIGNEE_ID = 'local';

const orders: WorkOrder[] = [];

export function listWorkOrders(): WorkOrder[] {
  return orders.map((item) => ({ ...item, summary: { ...item.summary } }));
}

export function workOrderAssigneeName(assigneeId: string | undefined): string | undefined {
  if (!assigneeId || assigneeId === LOCAL_ASSIGNEE_ID) return undefined;
  return adminUsers.find((user) => user.id === assigneeId)?.name;
}

function canAssign(assigneeId: string): boolean {
  if (assigneeId === LOCAL_ASSIGNEE_ID) return true;
  return adminUsers.some(
    (user) => user.id === assigneeId && user.status === 'active',
  );
}

export function setWorkOrderStatus(
  id: string,
  status: WorkOrderStatus,
): WorkOrder | undefined {
  const item = orders.find((row) => row.id === id);
  if (!item) return undefined;
  const allowed =
    (item.status === 'open' && status === 'in_progress') ||
    (item.status === 'in_progress' && status === 'resolved') ||
    (item.status === 'resolved' && status === 'open');
  if (!allowed) return undefined;
  item.status = status;
  if (status === 'in_progress') item.assigneeId = LOCAL_ASSIGNEE_ID;
  if (status === 'open') item.assigneeId = undefined;
  return { ...item, summary: { ...item.summary } };
}

export function assignWorkOrder(
  id: string,
  assigneeId: string,
): WorkOrder | undefined {
  const item = orders.find((row) => row.id === id);
  if (!item || item.status === 'resolved') return undefined;
  if (!canAssign(assigneeId)) return undefined;
  item.assigneeId = assigneeId;
  return { ...item, summary: { ...item.summary } };
}
