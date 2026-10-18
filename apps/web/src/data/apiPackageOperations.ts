/**
 * Extract merchandisable operations from eng packages for per-endpoint pricing.
 * - api: openapi.yaml paths
 * - model: function.json models[] (OpenAI-compatible chat SKUs)
 */

import { findCodePackage, type CodePackageKind } from '@/data/codePackages';
import { gatewayRelativePathForSku } from '@/data/servicePath';

export type ApiPackageOperation = {
  key: string;
  method: string;
  path: string;
  summary: string;
  operationId?: string;
  name?: string;
  description?: string;
  unitPriceUsd?: number;
};

const HTTP_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
] as const;

function findOpenApiYaml(packageId: string): string | undefined {
  const pkg = findCodePackage('api', packageId);
  if (!pkg) return undefined;
  const file =
    pkg.files.find((f) => f.path === 'openapi.yaml') ??
    pkg.files.find((f) => /\.ya?ml$/i.test(f.path) && /openapi/i.test(f.path)) ??
    pkg.files.find((f) => f.path.toLowerCase().includes('openapi'));
  return file?.content;
}

function listModelPackageOperations(packageId: string): ApiPackageOperation[] {
  const pkg = findCodePackage('model', packageId);
  if (!pkg) return [];
  const file = pkg.files.find((f) => f.path === 'function.json');
  if (!file?.content) return [];
  try {
    const parsed = JSON.parse(file.content) as {
      models?: Array<{ sku?: string; upstream?: string; name?: string }>;
      protocol?: string;
    };
    const models = parsed.models ?? [];
    return models
      .map((model) => {
        const sku = model.sku?.trim();
        if (!sku) return null;
        const path = `/v1${gatewayRelativePathForSku(sku, 'model')}`;

        return {
          key: `POST:${path}:${sku}`,
          method: 'POST',
          path,
          summary: model.name?.trim() || sku,
          operationId: sku,
          name: model.name?.trim() || sku,
          description: model.upstream
            ? `Upstream model: ${model.upstream}`
            : undefined,
        } satisfies ApiPackageOperation;
      })
      .filter((row) => row != null) as ApiPackageOperation[];
  } catch {
    return [];
  }
}

/**
 * Lightweight OpenAPI path scanner (no YAML dependency).
 * Good enough for fixture openapi.yaml shapes used in eng packages.
 */
export function listApiPackageOperations(
  packageId: string,
): ApiPackageOperation[] {
  const yaml = findOpenApiYaml(packageId);
  if (!yaml) return [];

  const lines = yaml.split('\n');
  const ops: ApiPackageOperation[] = [];
  let currentPath: string | null = null;
  let inPaths = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^paths:\s*$/.test(line)) {
      inPaths = true;
      currentPath = null;
      continue;
    }
    if (inPaths && /^\S/.test(line) && !line.startsWith(' ') && !line.startsWith('\t')) {
      // left paths section
      break;
    }
    if (!inPaths) continue;

    const pathMatch = line.match(/^ {2}(\/[^\s:]*):\s*$/);
    if (pathMatch) {
      currentPath = pathMatch[1]!;
      continue;
    }

    if (!currentPath) continue;

    const methodMatch = line.match(
      /^ {4}(get|post|put|patch|delete|head|options):\s*$/i,
    );
    if (!methodMatch) continue;

    const method = methodMatch[1]!.toUpperCase();
    let summary = '';
    let operationId: string | undefined;
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j] ?? '';
      if (/^ {4}\S/.test(next) || /^ {2}\S/.test(next) || /^\S/.test(next)) {
        break;
      }
      const sum = next.match(/^\s+summary:\s*(.+)\s*$/);
      if (sum) summary = sum[1]!.replace(/^['"]|['"]$/g, '').trim();
      const opId = next.match(/^\s+operationId:\s*(\S+)\s*$/);
      if (opId) operationId = opId[1];
    }

    const key = `${method}:${currentPath}`;
    ops.push({
      key,
      method,
      path: currentPath,
      summary: summary || operationId || currentPath,
      operationId,
    });
  }

  // Stable order: path then method
  return ops.sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
}

/** Operations for create-wizard endpoint pricing (api + model). */
export function listPackageEndpointOperations(
  kind: CodePackageKind | string,
  packageId: string,
): ApiPackageOperation[] {
  if (kind === 'model') return listModelPackageOperations(packageId);
  if (kind === 'api') return listApiPackageOperations(packageId);
  return [];
}

export function isHttpMethod(value: string): boolean {
  return (HTTP_METHODS as readonly string[]).includes(value.toLowerCase());
}
