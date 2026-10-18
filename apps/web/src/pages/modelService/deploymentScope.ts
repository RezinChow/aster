/** Deployments whose warehouse repo is this hub model (`owner/name`). */
export function deploymentsForRepo<T extends { repoId: string }>(
  deployments: readonly T[],
  repoId: string,
): T[] {
  const wanted = repoId.trim().toLowerCase();
  if (!wanted) return [];
  return deployments.filter((row) => row.repoId.trim().toLowerCase() === wanted);
}

/** Warehouse row for this hub model. Prefer a row that already has a content digest. */
export function warehouseModelForRepo<T extends { repo_id: string; content_digest?: string }>(
  models: readonly T[],
  repoId: string,
): T | undefined {
  const wanted = repoId.trim().toLowerCase();
  if (!wanted) return undefined;
  const matches = models.filter((model) => model.repo_id.trim().toLowerCase() === wanted);
  return matches.find((model) => model.content_digest?.trim()) ?? matches[0];
}
