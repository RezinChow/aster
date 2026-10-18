// Development-only visual fixture. It never connects to Cloud or a supplier.
import { createRoot } from 'react-dom/client';
import { AppShell } from '../../src/shell/AppShell';
import { SettingsPage } from '../../src/pages/SettingsPage';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ConsoleToastProvider } from '@a3s-lab/ui';
import {
  setUserSession,
  setCloudPersonCredential,
} from '../../src/lib/userSession';
import '../../src/styles.css';
const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  projectId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  environmentId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
setUserSession('a3s_us_visual_fixture', organizationId);
setCloudPersonCredential({
  accessToken: `a3s_${'ab'.repeat(32)}`,
  organizationId,
  principalId: projectId,
  subject: environmentId,
});
let settings = {
  profileId: 'ToWork',
  allowRealSend: false,
  provider: 'virtual',
  enabled: true,
  digestSecretRef: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd@1',
  maximumPerMinute: 10,
  signature: null,
  usernameSecretRef: null,
  credentialSecretRef: null,
  authMethod: null,
  responseFormat: null,
  timeoutMs: null,
  maxMessageChars: null,
  scenario: 'accept',
};
let revision = 1;
const records: unknown[] = [];
const profile = () => ({
  profileId: settings.profileId,
  provider: settings.provider,
  enabled: settings.enabled,
  revision,
  settings,
  definitionAcl:
    'sms "ToWork" {\n  enabled = true\n  // Visual fixture only\n}',
});
window.fetch = async (input, init) => {
  const url = String(input);
  let data: unknown;
  if (init?.method === 'POST') {
    const body = JSON.parse(String(init.body));
    if (url.endsWith('/sms/settings')) {
      settings = body.settings;
      revision += 1;
      data = { kind: 'profile', data: profile() };
    } else if (url.endsWith('/service-secrets'))
      data = { id: crypto.randomUUID(), currentVersion: 1 };
    else if (url.endsWith('/sms/messages')) {
      const record = {
        id: crypto.randomUUID(),
        profileId: settings.profileId,
        profileRevision: revision,
        provider: 'virtual',
        recipientMask: '***8000',
        state:
          settings.scenario === 'reject'
            ? 'rejected'
            : settings.scenario === 'unknown'
              ? 'indeterminate'
              : 'accepted',
        reason: null,
        providerMessageId: null,
        createdAt: new Date().toISOString(),
        settled: true,
      };
      records.unshift(record);
      data = { kind: 'message', data: record };
    } else return new Response('fixture route missing', { status: 404 });
  } else if (url.endsWith('/sms/profiles'))
    data = { kind: 'profiles', data: [profile()] };
  else if (url.endsWith('/sms/messages'))
    data = { kind: 'messages', data: records };
  else return new Response('fixture route missing', { status: 404 });
  return new Response(JSON.stringify({ code: 200, message: 'OK', data }), {
    headers: { 'content-type': 'application/json' },
  });
};
const root = document.getElementById('root');
if (root)
  createRoot(root).render(
    <ConsoleToastProvider>
      <MemoryRouter initialEntries={['/admin/settings/sms']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/admin/settings/:section" element={<SettingsPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ConsoleToastProvider>,
  );
