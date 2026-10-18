export type UserStatus = 'active' | 'invited' | 'disabled';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  customer: string;
  status: UserStatus;
  lastActive: string;
};

export type RoleStatus = 'system' | 'custom';

export type AdminRole = {
  id: string;
  name: string;
  description: string;
  members: number;
  permissions: number;
  kind: RoleStatus;
};

export type PermissionScope = 'org' | 'workspace' | 'runtime' | 'data';

export type AdminPermission = {
  id: string;
  key: string;
  name: string;
  scope: PermissionScope;
  description: string;
};

import type { PlanId } from './subscriptions';

export type CustomerStatus = 'active' | 'trial' | 'churned';
/** Same ids as the subscription catalog. */
export type CustomerPlan = PlanId;
/** Organization or natural person. Not a verification result. */
export type CustomerKind = 'organization' | 'individual';
/** Operator-recorded review state. Unverified is the default, not a failed check. */
export type CustomerVerification = 'unverified' | 'pending' | 'verified' | 'rejected';

export type AdminCustomer = {
  id: string;
  name: string;
  plan: CustomerPlan;
  seats: { used: number; total: number };
  owner: string;
  status: CustomerStatus;
  createdAt: string;
  kind: CustomerKind;
  /** Empty when no logo was uploaded. */
  logoUrl: string;
  legalName: string;
  website: string;
  region: string;
  /** Empty for individuals, or when the operator left it blank. */
  industry: string;
  verification: CustomerVerification;
  /** Registration or ID number the operator typed. Empty if not recorded. */
  verificationRef: string;
  /** Null when no billing ledger has a balance for this customer. */
  balance: number | null;
  /** Null when lifetime spend is not on a ledger. */
  spendTotal: number | null;
  /** Set only when balance or spendTotal is a real ledger amount. */
  currency: 'CNY' | 'USD' | null;
};


export const adminUsers: AdminUser[] = [];

export const adminRoles: AdminRole[] = [];

export const adminPermissions: AdminPermission[] = [];

export const adminCustomers: AdminCustomer[] = [];
