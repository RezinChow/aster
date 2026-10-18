/**
 * Caller-facing Supplier Vault errors (Work / Gateway / TryIt).
 *
 * Never leak ops paths (Suppliers UI, Provider Credentials, product names).
 * Ops guidance stays in Console i18n / admin copy only.
 */

/** Stable public error_code for unbound upstream Vault secrets. */
export const SUPPLIER_VAULT_ENV_MISSING_CODE = 'provider.credential_missing' as const;

/**
 * Unified reminder when a listing requires a Supplier Vault env binding
 * that is not present. Same string for every supplier / SKU.
 */
export const SUPPLIER_VAULT_ENV_MISSING_MESSAGE =
  'Supplier Vault environment variable is missing.';

export function supplierVaultEnvMissing(): {
  code: typeof SUPPLIER_VAULT_ENV_MISSING_CODE;
  message: typeof SUPPLIER_VAULT_ENV_MISSING_MESSAGE;
} {
  return {
    code: SUPPLIER_VAULT_ENV_MISSING_CODE,
    message: SUPPLIER_VAULT_ENV_MISSING_MESSAGE,
  };
}
