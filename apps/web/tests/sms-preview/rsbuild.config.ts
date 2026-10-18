import { defineConfig } from '@rsbuild/core';
import base from '../../rsbuild.config';
export default defineConfig({
  ...base,
  source: { ...base.source, entry: { index: './tests/sms-preview/entry.tsx' } },
  server: { host: '127.0.0.1', port: 3198, historyApiFallback: true },
  html: { title: 'SMS Console visual fixture' },
  output: { distPath: { root: 'dist-sms-preview' } },
});
