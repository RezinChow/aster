import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  workChecksumsUrl,
  workDownloadContent,
  workReleaseAssetBaseUrl,
  workReleaseAssets,
  workRepositoryUrl,
} from './download-content';

describe('Work release links', () => {
  test('provides one stable latest-release asset for every supported platform', () => {
    assert.deepEqual(workReleaseAssets.map((asset) => asset.id), [
      'macos-arm64',
      'macos-x64',
      'windows-x64',
      'linux-x64',
    ]);
    assert.equal(new Set(workReleaseAssets.map((asset) => asset.fileName)).size, 4);

    for (const asset of workReleaseAssets) {
      assert.equal(asset.href, `${workReleaseAssetBaseUrl}/${asset.fileName}`);
      assert.equal(
        asset.href.startsWith(`${workRepositoryUrl}/releases/download/desktop-latest/`),
        true,
      );
    }
  });

  test('publishes a checksum link beside the platform packages', () => {
    assert.equal(
      workChecksumsUrl,
      'https://github.com/A3S-Lab/a3s/releases/download/desktop-latest/SHA256SUMS.txt',
    );
  });

  test('keeps the download page copy focused on choosing a package', () => {
    const expectedKeys = [
      'allReleasesAction',
      'checksumAction',
      'cliDescription',
      'cliTitle',
      'description',
      'downloadAction',
      'historyDescription',
      'historyTitle',
      'installCli',
      'latestLabel',
      'previewNote',
      'releaseChangesTitle',
      'releaseDownloadsTitle',
      'releaseNotesAction',
      'releasePageAction',
      'skip',
      'sourceAction',
      'title',
    ];

    for (const locale of ['cn', 'en'] as const) {
      const content = workDownloadContent[locale];
      assert.deepEqual(Object.keys(content).sort(), expectedKeys);
      assert.ok(content.description.length <= 64);
      assert.ok(content.cliDescription.length <= 80);
    }

    assert.equal(workDownloadContent.cn.title, '下载 A3S Work');
    assert.equal(workDownloadContent.en.title, 'Download A3S Work');
  });
});
