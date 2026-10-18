/**
 * @deprecated Direct Cloud REST from the browser is retired.
 * Use `@/lib/skillsApi` → a3s-api `/cloud/skills*` only.
 * Kept as a stub so accidental imports fail closed at type/runtime.
 */

export type CloudSkillAsset = never;
export type CloudSkillRelease = never;

function retired(): never {
  throw new Error(
    'cloudSkillsApi is deprecated; use skillsApi (Console → a3s-api → Cloud)',
  );
}

/** @deprecated Use createCloudSkill from skillsApi */
export function createCloudSkillAsset(..._args: unknown[]): never {
  return retired();
}

/** @deprecated Use buildCloudSkillRelease from skillsApi */
export function createCloudSkillRelease(..._args: unknown[]): never {
  return retired();
}

/** @deprecated Use listCloudSkills from skillsApi */
export function listCloudSkillAssets(..._args: unknown[]): never {
  return retired();
}
