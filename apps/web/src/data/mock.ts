export type FlowStatus = 'running' | 'completed' | 'retrying' | 'suspended';

export type Flow = {
  id: string;
  name: string;
  workspace: string;
  status: FlowStatus;
  step: string;
  replay: number;
  startedAt: string;
  duration: string;
};

export type GatewayRoute = {
  id: string;
  path: string;
  kind: 'Agent' | 'Workflow' | 'Function' | 'Inference';
  policy: string;
  rpm: number;
  errorRate: string;
};

export type Workload = {
  id: string;
  name: string;
  runtime: string;
  box: string;
  replicas: string;
  cpu: string;
  status: 'healthy' | 'degraded' | 'pending';
};

export type FleetNode = {
  id: string;
  region: string;
  role: 'Runtime' | 'Box' | 'Power';
  load: number;
  version: string;
  status: 'ready' | 'draining' | 'offline';
};

export type OsEvent = {
  id: string;
  at: string;
  plane: 'Gateway' | 'Operations' | 'Workload' | 'Policy';
  level: 'info' | 'warn' | 'error';
  message: string;
};

export const stats = {
  flows: { value: '0', hint: '' },
  gateway: { value: '0', hint: '' },
  fleet: { value: '0', hint: '' },
  policies: { value: '0', hint: '' },
};

export const flows: Flow[] = [];

export const flowJournal: Array<{ seq: number; at: string; kind: string; body: string }> = [];

export const gatewayRoutes: GatewayRoute[] = [];

export const workloads: Workload[] = [];

export const fleet: FleetNode[] = [];

export const events: OsEvent[] = [];

export const policies: Array<{ id: string; name: string; scope: string; body: string }> = [];
