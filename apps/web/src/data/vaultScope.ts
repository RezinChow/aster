/**
 * Vault scope contract shared with Runtime.
 */

export type VaultProviderId = 'boyue' | 'siliconflow' | 'worldmonitor';

export type VaultScope = {
  organization_id: string;
  project_id: string;
  environment_id: string;
};

export function defaultVaultScope(): VaultScope {
  return {
    organization_id: 'org_local',
    project_id: 'proj_local',
    environment_id: 'env_local',
  };
}
