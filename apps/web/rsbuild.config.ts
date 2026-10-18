import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { a3sAppResolve } from '@a3s-lab/ui/rsbuild';
import { tenantLogoUrl, type TenantInfo } from './src/prefs/tenantInfo.ts';
import { loadTenant } from '../../scripts/tenant-fs.ts';
import { tenantAdminMiddleware } from './dev/tenantAdminMiddleware.ts';

const SLUG_RE = /^[a-z][a-z0-9-]{0,31}$/;
const slug = process.env.PUBLIC_A3S_TENANT_SLUG || process.env.A3S_TENANT_SLUG || '';
if (!SLUG_RE.test(slug)) {
  throw new Error('A3S_TENANT_SLUG is required');
}
process.env.A3S_TENANT_SLUG = slug;
process.env.PUBLIC_A3S_TENANT_SLUG = slug;
const launchTenant = loadTenant(slug).info;

function launchDocumentScript(info: TenantInfo): string {
  const payload = {
    slug: info.slug,
    nameZh: info.name.zh,
    nameEn: info.name.en,
    lightLogo: tenantLogoUrl(info, 'light'),
    darkLogo: tenantLogoUrl(info, 'dark'),
    brand: info.brand,
    onBrand: info.on_brand,
    themeLight: info.theme_color.light,
    themeDark: info.theme_color.dark,
  };
  const json = JSON.stringify(payload).replaceAll('<', '\\u003c');
  return `(function(){var tenant=${json};try{var theme=localStorage.getItem('kense.os.theme');var locale=localStorage.getItem('kense.os.locale');theme=theme==='dark'||theme==='light'?theme:'light';var overrideName='';var overrideLogo=null;try{var raw=localStorage.getItem('kense.os.brandOverride');var map=raw?JSON.parse(raw):null;var entry=map&&typeof map==='object'?map[tenant.slug]:null;if(entry&&typeof entry==='object'){if(typeof entry.name==='string')overrideName=entry.name.trim();if(typeof entry.logo==='string'&&entry.logo.indexOf('data:image/')===0)overrideLogo=entry.logo;}}catch(e){}var brand=overrideName||(locale==='en'?tenant.nameEn:tenant.nameZh);var path=location.pathname||'/';var surface=path==='/admin'||path.indexOf('/admin/')===0?'admin':'plain';var suffix=surface==='admin'?(locale==='en'?'Admin Console':'管理后台'):'';document.title=suffix?brand+' - '+suffix:brand;var href=overrideLogo||(theme==='dark'?tenant.darkLogo:tenant.lightLogo);var links=document.querySelectorAll('link[rel="icon"],link[rel="shortcut icon"],link[rel="apple-touch-icon"]');for(var i=0;i<links.length;i++)links[i].setAttribute('href',href);var themeColor=document.querySelector('meta[name="theme-color"]');if(themeColor)themeColor.setAttribute('content',theme==='dark'?tenant.themeDark:tenant.themeLight);document.documentElement.style.setProperty('--color-brand',tenant.brand);document.documentElement.style.setProperty('--color-on-brand',tenant.onBrand);}catch(e){}})();`;
}

const appDir = path.dirname(fileURLToPath(import.meta.url));
const flowUiRoot = path.resolve(appDir, '../../crates/flow/packages/ui');
const flowUiSrc = path.join(flowUiRoot, 'src');
const officeDist = path.resolve(appDir, '../../packages/office/dist');
const { alias, include, dedupe } = a3sAppResolve(import.meta.url);

// Encyclopedia notes use this build's `presentation="note"`. The published
// pin under node_modules does not include that writing page.
const officeAlias = {
  '@a3s-lab/office/react': path.join(officeDist, 'react.js'),
  '@a3s-lab/office/core': path.join(officeDist, 'core.js'),
  '@a3s-lab/office/styles.css': path.join(officeDist, 'styles.css'),
  '@a3s-lab/office': path.join(officeDist, 'index.js'),
} as const;

// The office bundle resolves React from its own tree. Keep the console on one copy.
const reactAlias = {
  'react$': path.resolve(appDir, 'node_modules/react'),
  'react-dom$': path.resolve(appDir, 'node_modules/react-dom'),
  'react/jsx-runtime$': path.resolve(appDir, 'node_modules/react/jsx-runtime.js'),
  'react/jsx-dev-runtime$': path.resolve(appDir, 'node_modules/react/jsx-dev-runtime.js'),
} as const;

export default defineConfig({
  plugins: [pluginReact()],
  source: {
    alias: {
      ...alias,
      ...officeAlias,
      ...reactAlias,
      '@a3s-lab/flow-ui/react': path.join(flowUiSrc, 'react.ts'),
      '@a3s-lab/flow-ui': path.join(flowUiSrc, 'index.ts'),
      '@rspress/core/runtime': path.resolve(
        appDir,
        'src/flow-designer/rspress-shim.ts',
      ),
    },
    include: [flowUiSrc, ...include],
  },
  resolve: {
    aliasStrategy: 'prefer-alias',
    alias: {
      '@': path.resolve(appDir, 'src'),
      ...officeAlias,
      ...reactAlias,
      '@a3s-lab/flow-ui/react': path.join(flowUiSrc, 'react.ts'),
      '@a3s-lab/flow-ui': path.join(flowUiSrc, 'index.ts'),
      '@rspress/core/runtime': path.resolve(
        appDir,
        'src/flow-designer/rspress-shim.ts',
      ),
    },
    dedupe,
  },
  tools: {
    rspack: (config) => {
      // Compact hashed IDs collide in this workbench's existing chunk graph.
      // Deterministic IDs retain stable production assets without that allocator.
      config.optimization ??= {};
      config.optimization.chunkIds = 'deterministic';
      config.resolve ??= {};
      const modules = config.resolve.modules ?? ['node_modules'];
      config.resolve.modules = [
        path.resolve(appDir, 'node_modules'),
        ...modules.filter((entry) => entry !== path.resolve(appDir, 'node_modules')),
      ];
      return config;
    },
  },
  server: {
    // Probes and the printed Console URL use 127.0.0.1. Node's localhost
    // resolves to ::1 first and would not accept that address.
    host: '127.0.0.1',
    port: 3100,
    historyApiFallback: true,
    proxy: {
      // Platform admin and member APIs go straight to a3s-api.
      // /v1/api/services stays on the gateway. Model standards stay on /v1.
      '/v1/api/admin': {
        target: 'http://127.0.0.1:3000',
      },
      '/v1/api/org': {
        target: 'http://127.0.0.1:3000',
      },
      // Published notices. /v1/api/legal/{slug} is served by a3s-api.
      '/v1/api/legal': {
        target: 'http://127.0.0.1:3000',
      },
      // Same-origin Cloud API (queues / event-bus). Avoids browser CORS to :18080.
      '/cloud-api': {
        target: process.env.A3S_CLOUD_API_ORIGIN ?? 'http://127.0.0.1:18080',
        pathRewrite: { '^/cloud-api': '/api/v1' },
      },
      '/cloud-openapi': {
        target: process.env.A3S_CLOUD_API_ORIGIN ?? 'http://127.0.0.1:18080',
        pathRewrite: { '^/cloud-openapi': '/api/v1' },
      },
      // Same-origin SSH bridge. The page reads the default user and opens
      // the terminal websocket without a cross-origin fetch.
      '/fleet-ssh': {
        target: 'http://127.0.0.1:13101',
        pathRewrite: { '^/fleet-ssh': '' },
        ws: true,
      },
    },
    setup(context) {
      if (context.action !== 'dev') return;
      context.server.middlewares.use(tenantAdminMiddleware(slug));
    },
  },
  html: {
    template: './index.html',
    templateParameters: {
      tenantSlug: launchTenant.slug,
    },
    title: launchTenant.name.zh,
    favicon: `./public/tenant/${launchTenant.slug}/${launchTenant.logos.light_surface}`,
    meta: {
      viewport: 'width=device-width, initial-scale=1',
      description: launchTenant.description.zh,
      'theme-color': launchTenant.theme_color.light,
    },
    tags: [
      {
        tag: 'link',
        attrs: {
          rel: 'apple-touch-icon',
          sizes: '180x180',
          href: tenantLogoUrl(launchTenant, 'light'),
        },
      },
      {
        tag: 'script',
        attrs: {},
        children: launchDocumentScript(launchTenant),
      },
    ],
  },
});
