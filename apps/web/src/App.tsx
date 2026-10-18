import { ConsoleToastProvider } from '@a3s-lab/ui';
import { useLayoutEffect, type ReactNode } from 'react';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { AppShell } from '@/shell/AppShell';
import { CustomersPage } from '@/pages/CustomersPage';
import { ChannelsPage } from '@/pages/ChannelsPage';
import { ChannelLevelsPage } from '@/pages/ChannelLevelsPage';
import { ChannelDetailPage } from '@/pages/ChannelDetailPage';
import { SuppliersPage } from '@/pages/SuppliersPage';
import { SupplierDetailPage } from '@/pages/SupplierDetailPage';
import { EventsPage } from '@/pages/EventsPage';
import { FleetPage } from '@/pages/FleetPage';
import { FlowDetailPage } from '@/pages/FlowDetailPage';
import { FlowsPage } from '@/pages/FlowsPage';
import { FunctionsPage } from '@/pages/FunctionsPage';
import { CellsPage } from '@/pages/CellsPage';
import { AgentRuntimesPage } from '@/pages/AgentRuntimesPage';
import { GatewayPage } from '@/pages/GatewayPage';
import { SupplierModelsPage } from '@/pages/modelService/SupplierModelsPage';
import { LoginPage } from '@/pages/LoginPage';
import { ApiDocsPage } from '@/pages/apiDocs/ApiDocsPage';
import { docsHref, type DocsSource } from '@/lib/docsRoute';
import { MarketplacePage } from '@/pages/MarketplacePage';
import { MarketplaceEntitledPage } from '@/pages/MarketplaceEntitledPage';
import { MarketplaceListingPage } from '@/pages/MarketplaceListingPage';
import { MarketplaceProviderPage } from '@/pages/MarketplaceProviderPage';
import { MarketplaceAddProviderPage } from '@/pages/MarketplaceAddProviderPage';
import { OverviewPage } from '@/pages/OverviewPage';
import { AdminMembersPage } from '@/pages/platform/AdminMembersPage';
import { AdminPositionsPage } from '@/pages/platform/AdminPositionsPage';
import { AdminRolesPage } from '@/pages/platform/AdminRolesPage';
import { PlatformOrgDirectory } from '@/pages/platform/PlatformOrgDirectory';
import { SubscriptionsPage } from '@/pages/SubscriptionsPage';
import { WorkOrdersPage } from '@/pages/WorkOrdersPage';
import { PlaceholderPage } from '@/pages/PlaceholderPage';
import { SettingsPage } from '@/pages/SettingsPage';

import { OpsPage } from '@/pages/OpsPage';
import { UsagePage } from '@/pages/UsagePage';
import { ModelHubPage } from '@/pages/assets/models/ModelHubPage';
import { ModelDetailPage } from '@/pages/assets/models/ModelDetailPage';
import { AgentHubPage } from '@/pages/assets/agents/AgentHubPage';
import { AgentDetailPage } from '@/pages/assets/agents/AgentDetailPage';
import { ConnectorHubPage } from '@/pages/assets/connectors/ConnectorHubPage';
import { ConnectorDetailPage } from '@/pages/assets/connectors/ConnectorDetailPage';
import { PluginHubPage } from '@/pages/assets/plugins/PluginHubPage';
import { PluginDetailPage } from '@/pages/assets/plugins/PluginDetailPage';
import { AppletHubPage } from '@/pages/assets/applets/AppletHubPage';
import { AppletDetailPage } from '@/pages/assets/applets/AppletDetailPage';
import { SkillHubPage } from '@/pages/assets/skills/SkillHubPage';
import { SkillHubDetailPage } from '@/pages/assets/skills/SkillHubDetailPage';
import { documentSurfaceForPath } from '@/prefs/documentTitle';
import { setDocumentSurface, useTenantLoad } from '@/prefs/store';
import { getUserToken } from '@/lib/identityApi';
import type { MessageKey } from '@/i18n/messages';

function DestPlaceholder({
  titleKey,
  descriptionKey,
}: {
  titleKey: MessageKey;
  descriptionKey: MessageKey;
}) {
  return (
    <PlaceholderPage titleKey={titleKey} descriptionKey={descriptionKey} />
  );
}

/** Legacy path compat: rewrite the prefix, keep the tail and query. */
function PrefixCompat({ from, to }: { from: string; to: string }) {
  const location = useLocation();
  return (
    <Navigate
      to={{ pathname: location.pathname.replace(from, to), search: location.search }}
      replace
    />
  );
}

/** Old Cloud and Work docs URLs join the single /docs page. */
function DocsSourceRedirect({ source }: { source: DocsSource }) {
  const { opId } = useParams();
  return <Navigate to={docsHref(opId, source)} replace />;
}

function RequireUserAuth() {
  if (!getUserToken()) {
    return <Navigate to="/admin/login" replace />;
  }
  return <Outlet />;
}

/** Bookmark repair: pre-portal console URLs live under `/admin` now. */
function LegacyConsoleRedirect() {
  const { pathname, search } = useLocation();
  return <Navigate to={`/admin${pathname}${search}`} replace />;
}

function TenantGate({ children }: { children: ReactNode }) {
  const load = useTenantLoad();
  if (!load.ready) return null;
  if (load.error) {
    return (
      <div className="os-tenant-block" role="alert">
        <p>无法加载平台信息（{load.slug}）</p>
      </div>
    );
  }
  return children;
}

function DocumentTitle() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    setDocumentSurface(documentSurfaceForPath(pathname));
  }, [pathname]);
  return null;
}

export function AppRoutes() {
  return (
        <>
        <DocumentTitle />
        <Routes>
        {/* 管理后台 — platform console（/admin）。用户中心已并入桌面客户端，站点根落在后台。 */}
        <Route path="admin/login" element={<LoginPage />} />
        <Route path="docs" element={<ApiDocsPage />} />
        <Route path="docs/:opId" element={<ApiDocsPage />} />
        <Route path="admin/cloud/docs" element={<DocsSourceRedirect source="cloud" />} />
        <Route path="admin/cloud/docs/:opId" element={<DocsSourceRedirect source="cloud" />} />
        <Route path="admin/developer/docs" element={<DocsSourceRedirect source="work" />} />
        <Route
          path="admin/developer/docs/:opId"
          element={<DocsSourceRedirect source="work" />}
        />
        <Route element={<RequireUserAuth />}>
          <Route path="admin" element={<AppShell />}>
          <Route index element={<OverviewPage lens="home" />} />
          <Route
            path="overview/ops"
            element={<Navigate to="/admin/topology" replace />}
          />
          <Route path="ops" element={<Navigate to="/admin/topology" replace />} />
          <Route path="platform" element={<OverviewPage lens="platform" />} />
          <Route
            path="overview/platform"
            element={<Navigate to="/admin/platform" replace />}
          />
          <Route path="topology" element={<OpsPage />} />

          <Route element={<PlatformOrgDirectory />}>
            <Route path="team/members" element={<AdminMembersPage />} />
            <Route path="team/positions" element={<AdminPositionsPage />} />
            <Route path="team/roles" element={<AdminRolesPage />} />
          </Route>
          <Route
            path="enterprise/*"
            element={<PrefixCompat from="/admin/enterprise" to="/admin/team" />}
          />
          <Route
            path="members"
            element={<PrefixCompat from="/admin/members" to="/admin/team/members" />}
          />
          <Route
            path="positions"
            element={<PrefixCompat from="/admin/positions" to="/admin/team/positions" />}
          />
          <Route
            path="roles"
            element={<PrefixCompat from="/admin/roles" to="/admin/team/roles" />}
          />
          <Route
            path="organizations"
            element={<Navigate to="/admin/team/members" replace />}
          />
          <Route
            path="departments"
            element={<Navigate to="/admin/team/members" replace />}
          />
          <Route
            path="users"
            element={<Navigate to="/admin/team/members" replace />}
          />
          <Route
            path="permissions"
            element={<Navigate to="/admin/team/roles" replace />}
          />

          {/* Products */}
          <Route path="workflows" element={<FlowsPage />} />
          <Route path="workflows/:id" element={<FlowDetailPage />} />
          <Route path="work-orders" element={<WorkOrdersPage />} />
          <Route path="tasks" element={<Navigate to="/admin/work-orders" replace />} />
          <Route path="functions" element={<FunctionsPage />} />
          <Route path="agents" element={<AgentRuntimesPage />} />
          <Route path="agent-runtimes" element={<Navigate to="/admin/agents" replace />} />
          <Route path="cells" element={<CellsPage />} />
          <Route path="inference" element={<Navigate to="/admin/assets/models" replace />} />
          <Route path="model-service" element={<Navigate to="/admin/assets/models" replace />} />
          <Route path="marketplace" element={<MarketplacePage />} />
          <Route
            path="marketplace/entitled"
            element={<MarketplaceEntitledPage />}
          />
          <Route
            path="marketplace/providers/new"
            element={<MarketplaceAddProviderPage />}
          />
          <Route
            path="marketplace/providers/:id"
            element={<MarketplaceProviderPage />}
          />
          <Route
            path="marketplace/listings/:id"
            element={<MarketplaceListingPage />}
          />
          <Route
            path="applications"
            element={<DestPlaceholder titleKey="nav.applications" descriptionKey="nav.applicationsDesc" />}
          />

          {/* 运营 · 资产 — 模型 / 智能体 / 小程序 / 连接器 / 技能 */}
          <Route path="assets/models" element={<ModelHubPage />} />
          <Route path="assets/models/:owner/:name" element={<ModelDetailPage />} />
          <Route path="assets/agents" element={<AgentHubPage />} />
          <Route path="assets/agents/:slug" element={<AgentDetailPage />} />
          <Route path="assets/applets" element={<AppletHubPage />} />
          <Route path="assets/applets/:publisher/:name" element={<AppletDetailPage />} />
          <Route path="assets/connectors" element={<ConnectorHubPage />} />
          <Route path="assets/connectors/:slug" element={<ConnectorDetailPage />} />
          <Route path="assets/plugins" element={<PluginHubPage />} />
          <Route path="assets/plugins/:publisher/:name" element={<PluginDetailPage />} />
          <Route path="assets/skills" element={<SkillHubPage />} />
          <Route path="assets/skills/:slug" element={<SkillHubDetailPage />} />
          <Route
            path="models"
            element={<PrefixCompat from="/admin/models" to="/admin/assets/models" />}
          />
          <Route
            path="model-catalog"
            element={<Navigate to="/admin/assets/models" replace />}
          />
          <Route
            path="capabilities/connectors"
            element={<Navigate to="/admin/assets/connectors" replace />}
          />
          <Route
            path="capabilities/*"
            element={<Navigate to="/admin/assets/skills" replace />}
          />
          <Route
            path="market/models"
            element={<Navigate to="/admin/assets/models" replace />}
          />
          <Route
            path="market/models/:packageId"
            element={<Navigate to="/admin/assets/models" replace />}
          />
          <Route
            path="market/connectors/*"
            element={<Navigate to="/admin/assets/connectors" replace />}
          />
          <Route
            path="market/skills/*"
            element={<Navigate to="/admin/assets/skills" replace />}
          />

          <Route
            path="connectors"
            element={<Navigate to="/admin/assets/connectors" replace />}
          />
          <Route path="skills" element={<Navigate to="/admin/assets/skills" replace />} />

          {/* Runtime & edge */}
          <Route
            path="workloads"
            element={<Navigate to="/admin/gateway" replace />}
          />
          <Route path="fleet" element={<FleetPage />} />
          <Route path="gateway" element={<GatewayPage />} />

          {/* Ops */}
          <Route path="logs" element={<EventsPage />} />
          <Route path="events" element={<Navigate to="/admin/logs" replace />} />
          <Route path="usage" element={<UsagePage />} />
          <Route
            path="notifications"
            element={<Navigate to="/admin/logs" replace />}
          />
          <Route
            path="system"
            element={<Navigate to="/admin/settings/system" replace />}
          />

          {/* Commerce · Business */}
          <Route path="customers" element={<CustomersPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="channels/new" element={<Navigate to="/admin/channels" replace />} />
          <Route path="channels/levels" element={<ChannelLevelsPage />} />
          <Route path="channels/:id" element={<ChannelDetailPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="suppliers/:supplierId/models" element={<SupplierModelsPage />} />
          <Route path="suppliers/:id" element={<SupplierDetailPage />} />
          <Route
            path="orders"
            element={<DestPlaceholder titleKey="nav.orders" descriptionKey="nav.ordersDesc" />}
          />
          <Route path="subscriptions" element={<SubscriptionsPage />} />

          <Route path="settings" element={<SettingsPage />} />
          <Route path="settings/:section" element={<SettingsPage />} />

          {/* Legacy redirects */}
          <Route path="flows" element={<Navigate to="/admin/workflows" replace />} />
          <Route
            path="flows/:id"
            element={<FlowLegacyRedirect />}
          />
          <Route
            path="identity"
            element={<Navigate to="/admin/team/members" replace />}
          />
          <Route
            path="policies"
            element={<Navigate to="/admin/team/roles" replace />}
          />
          <Route
            path="credentials"
            element={<Navigate to="/admin/team/members" replace />}
          />
          <Route
            path="audit"
            element={<Navigate to="/admin/team/members" replace />}
          />

          <Route path="*" element={<Navigate to="/admin/" replace />} />
          </Route>
        </Route>

        {/* Pre-portal bookmarks: `/users` → `/admin/users`, … */}
        <Route path="*" element={<LegacyConsoleRedirect />} />
      </Routes>
        </>
  );
}

export default function App() {
  return (
    <ConsoleToastProvider>
      <TenantGate>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TenantGate>
    </ConsoleToastProvider>
  );
}

function FlowLegacyRedirect() {
  const { id } = useParams();
  return (
    <Navigate
      to={id ? `/admin/workflows/${id}` : '/admin/workflows'}
      replace
    />
  );
}
