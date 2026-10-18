/** Flat path list → nested tree for GitHub-style file browsers. */

export type RepoFile = {
  id: string;
  path: string;
  language: string;
  content: string;
};

export type RepoTreeDir = {
  type: 'dir';
  name: string;
  path: string;
  children: RepoTreeNode[];
};

export type RepoTreeFile = {
  type: 'file';
  name: string;
  path: string;
  file: RepoFile;
};

export type RepoTreeNode = RepoTreeDir | RepoTreeFile;

function sortNodes(nodes: RepoTreeNode[]): RepoTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function buildRepoTree(files: RepoFile[]): RepoTreeNode[] {
  type MutableDir = {
    type: 'dir';
    name: string;
    path: string;
    children: Map<string, MutableDir | RepoTreeFile>;
  };

  const root: MutableDir = {
    type: 'dir',
    name: '',
    path: '',
    children: new Map(),
  };

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    if (parts.length === 0) continue;
    let cursor = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const name = parts[i]!;
      const dirPath = parts.slice(0, i + 1).join('/');
      let next = cursor.children.get(name);
      if (!next || next.type !== 'dir') {
        next = {
          type: 'dir',
          name,
          path: dirPath,
          children: new Map(),
        };
        cursor.children.set(name, next);
      }
      cursor = next;
    }
    const fileName = parts[parts.length - 1]!;
    cursor.children.set(fileName, {
      type: 'file',
      name: fileName,
      path: file.path,
      file,
    });
  }

  function freeze(dir: MutableDir): RepoTreeNode[] {
    const nodes: RepoTreeNode[] = [];
    for (const child of dir.children.values()) {
      if (child.type === 'dir') {
        nodes.push({
          type: 'dir',
          name: child.name,
          path: child.path,
          children: sortNodes(freeze(child)),
        });
      } else {
        nodes.push(child);
      }
    }
    return sortNodes(nodes);
  }

  return freeze(root);
}

/** GitHub-like default: README* → SKILL.md → first file by tree order. */
export function pickDefaultFile(files: RepoFile[]): RepoFile | undefined {
  if (files.length === 0) return undefined;
  const readme =
    files.find((f) => f.path.toLowerCase() === 'readme.md') ??
    files.find((f) => {
      const base = f.path.split('/').pop() ?? '';
      return /^readme(\.|$)/i.test(base);
    });
  if (readme) return readme;
  const skill = files.find((f) => f.path === 'SKILL.md');
  if (skill) return skill;
  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  return sorted[0];
}

export function languageFromPath(path: string, fallback = 'plaintext'): string {
  const name = path.split('/').pop() ?? path;
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'md':
    case 'mdx':
      return 'markdown';
    case 'rs':
      return 'rust';
    case 'py':
      return 'python';
    case 'go':
      return 'go';
    case 'sh':
    case 'bash':
      return 'bash';
    case 'css':
      return 'css';
    case 'html':
      return 'xml';
    case 'toml':
      return 'ini';
    default:
      return fallback;
  }
}

export function formatByteSize(content: string): string {
  const bytes = new TextEncoder().encode(content).length;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

export function countLines(content: string): number {
  if (!content) return 0;
  return content.split('\n').length;
}
