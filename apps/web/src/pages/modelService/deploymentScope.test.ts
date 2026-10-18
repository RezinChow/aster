import { describe, expect, test } from 'bun:test';
import { deploymentsForRepo, warehouseModelForRepo } from './deploymentScope';

describe('deploymentsForRepo', () => {
  const rows = [
    { id: 'a', repoId: 'PaddlePaddle/PaddleOCR-VL-1.6' },
    { id: 'b', repoId: 'Qwen/Qwen3-8B' },
  ];

  test('matches the hub owner and name without regard to case', () => {
    expect(deploymentsForRepo(rows, ' paddlepaddle/paddleocr-vl-1.6 ').map((row) => row.id)).toEqual(['a']);
  });

  test('matches none for a blank repo', () => {
    expect(deploymentsForRepo(rows, '  ')).toEqual([]);
  });
});

describe('warehouseModelForRepo', () => {
  const models = [
    { id: 'plain', repo_id: 'Qwen/Qwen3-8B' },
    { id: 'digest', repo_id: 'qwen/qwen3-8b', content_digest: 'sha256:abc' },
  ];

  test('prefers the matching row that has a content digest', () => {
    expect(warehouseModelForRepo(models, 'Qwen/Qwen3-8B')?.id).toBe('digest');
  });

  test('returns nothing when the warehouse has no such repo', () => {
    expect(warehouseModelForRepo(models, 'missing/model')).toBeUndefined();
  });
});
