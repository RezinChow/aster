import {
  a3sFlowDagNodeRegistry,
  type A3sFlowDagNodeRegistry,
} from '@a3s-lab/flow-ui';
import { createContext, useContext } from 'react';

export const WorkflowPlaygroundRegistryContext =
  createContext<A3sFlowDagNodeRegistry>(a3sFlowDagNodeRegistry);

export function useWorkflowPlaygroundRegistry(): A3sFlowDagNodeRegistry {
  return useContext(WorkflowPlaygroundRegistryContext);
}
