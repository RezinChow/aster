import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { cn } from '@a3s-lab/ui';
import { useI18n } from '@/i18n/useI18n';
import { DOCS_SOURCES, docsHref, parseDocsSource, type DocsSource } from '@/lib/docsRoute';
import {
  fetchCloudOpenApiDocument,
  fetchOpenApiDocument,
  fetchPlatformOpenApiDocument,
  groupOperations,
  parseOpenApiDocument,
  schemaTypeLabel,
  CLOUD_API_BASE,
  type ApiOperation,
  type OpenApiDocument,
  type OpenApiParameter,
} from '@/lib/openapi';
import { gatewayAbsoluteUrl, gatewayOrigin } from '@/lib/workConnect';
import { setLocale } from '@/prefs/store';
import { BrandMark } from '@/shell/BrandMark';
import {
  buildRequestUrl,
  defaultBodyExample,
  generateCode,
  highlightLangFor,
  responseExamples,
  type CodeLang,
} from './codegen';
import { HighlightedCode } from './HighlightedCode';
import { LangSelect } from './LangSelect';
import {
  groupLabel,
  matchesOperationQuery,
  operationTitle,
  textMatchesLocale,
} from './labels';
import {
  buildSideCatalog,
  catalogBranchIds,
  countCatalogOperations,
  docsPlaneForPath,
  preferCatalogOp,
  type CatalogNode,
  type DocsPlane,
} from './catalogTree';
import { TryItPlayground } from './TryItPlayground';
import '@/styles/api-docs.css';

/** First open of /docs in this page load uses Chinese. Later toggles stay. */
let osDocsLocaleApplied = false;

const SOURCE_LABEL: Record<DocsSource, 'apiDocs.sourceOs' | 'apiDocs.sourceCloud' | 'apiDocs.sourceWork'> = {
  os: 'apiDocs.sourceOs',
  cloud: 'apiDocs.sourceCloud',
  work: 'apiDocs.sourceWork',
};

export function ApiDocsPage() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const { opId } = useParams();
  const [searchParams] = useSearchParams();
  const source = parseDocsSource(searchParams.get('source'));
  const apiBase = source === 'cloud' ? CLOUD_API_BASE : source === 'os' ? osOrigin() : null;

  useEffect(() => {
    if (osDocsLocaleApplied) return;
    osDocsLocaleApplied = true;
    setLocale('zh');
  }, []);

  const [doc, setDoc] = useState<OpenApiDocument | null>(null);
  const [ops, setOps] = useState<ApiOperation[]>([]);
  const [loadedSource, setLoadedSource] = useState<DocsSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [tryOpen, setTryOpen] = useState(false);
  const [planeChoice, setPlaneChoice] = useState<DocsPlane | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load =
      source === 'cloud'
        ? fetchCloudOpenApiDocument()
        : source === 'os'
          ? fetchPlatformOpenApiDocument()
          : fetchOpenApiDocument(locale);
    void load
      .then((spec) => {
        if (cancelled) return;
        setDoc(spec);
        setOps(parseOpenApiDocument(spec));
        setLoadedSource(source);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setDoc(null);
        setOps([]);
        setLoadedSource(source);
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [locale, source]);

  const specReady = loadedSource === source && !loading;
  useEffect(() => {
    if (!specReady || error || !ops.length) return;
    if (!opId || !ops.some((op) => op.id === opId)) {
      const landing =
        source === 'os'
          ? (preferCatalogOp(
              ops.filter((op) => docsPlaneForPath(op.path) === 'front'),
              'front',
            ) ?? ops[0])
          : ops[0];
      if (!landing) return;
      navigate(docsHref(landing.id, source), { replace: true });
    }
  }, [specReady, error, ops, opId, navigate, source]);

  const linked = ops.find((op) => op.id === opId);
  const activePlane: DocsPlane =
    source === 'os'
      ? (planeChoice ?? (linked && docsPlaneForPath(linked.path) === 'back' ? 'back' : 'front'))
      : 'front';
  const scoped = useMemo(() => {
    if (source !== 'os') return ops;
    return ops.filter((op) => docsPlaneForPath(op.path) === activePlane);
  }, [ops, source, activePlane]);
  const filtered = useMemo(() => {
    return scoped.filter((op) => matchesOperationQuery(op, query, locale));
  }, [scoped, query, locale]);

  const groups = useMemo(() => groupOperations(filtered), [filtered]);
  const current =
    (linked && scoped.some((op) => op.id === linked.id) ? linked : undefined) ??
    preferCatalogOp(filtered, activePlane) ??
    preferCatalogOp(scoped, activePlane) ??
    ops[0];

  function selectSource(next: DocsSource) {
    if (next === source) return;
    setPlaneChoice(null);
    navigate(docsHref(undefined, next));
  }

  function selectPlane(next: DocsPlane) {
    setPlaneChoice(next);
    const inPlane = ops.filter((op) => docsPlaneForPath(op.path) === next);
    if (linked && inPlane.some((op) => op.id === linked.id)) return;
    const visible = inPlane.filter((op) => matchesOperationQuery(op, query, locale));
    const target = preferCatalogOp(visible, next) ?? preferCatalogOp(inPlane, next);
    if (target) navigate(docsHref(target.id, source));
  }

  return (
    <div className="api-docs">
      <header className="api-docs__top">
        <div className="api-docs__bar">
          <Link to={docsHref(undefined, source)} className="api-docs__brand">
            <BrandMark size={22} alt="" />
            <span>{t('apiDocs.osTitle')}</span>
          </Link>
          <div className="api-docs__tools">
            <input
              className="api-docs__search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('apiDocs.search')}
              aria-label={t('apiDocs.search')}
            />
            <div className="api-docs__top-actions">
              <button
                type="button"
                className="api-docs__ghost"
                onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}
              >
                {locale === 'zh' ? t('shell.localeEn') : t('shell.localeZh')}
              </button>
              <Link to="/admin/" className="api-docs__ghost">
                {t('apiDocs.backToConsole')}
              </Link>
            </div>
          </div>
        </div>
        <div className="api-docs__sub">
          <nav className="api-docs__sources" aria-label={t('apiDocs.sources')}>
            {DOCS_SOURCES.map((item) => (
              <button
                key={item}
                type="button"
                aria-current={source === item ? 'page' : undefined}
                className={cn('api-docs__source', source === item && 'is-active')}
                onClick={() => selectSource(item)}
              >
                {t(SOURCE_LABEL[item])}
              </button>
            ))}
          </nav>
          {source === 'os' ? (
            <div className="api-docs__scope" role="radiogroup" aria-label={t('apiDocs.planes')}>
              <button
                type="button"
                role="radio"
                aria-checked={activePlane === 'front'}
                className={cn('api-docs__scope-item', activePlane === 'front' && 'is-active')}
                onClick={() => selectPlane('front')}
              >
                {t('apiDocs.planeFront')}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={activePlane === 'back'}
                className={cn('api-docs__scope-item', activePlane === 'back' && 'is-active')}
                onClick={() => selectPlane('back')}
              >
                {t('apiDocs.planeBack')}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {!specReady ? (
        <div className="api-docs__loading">{t('apiDocs.loading')}</div>
      ) : error ? (
        <div className="api-docs__error">{error}</div>
      ) : !current || !doc ? (
        <div className="api-docs__empty">{t('apiDocs.empty')}</div>
      ) : (
        <>
          <div className="api-docs__body">
            <EndpointTree
              groups={groups}
              locale={locale}
              currentId={current.id}
              emptyLabel={t('apiDocs.noMatches')}
              ariaLabel={t('apiDocs.sidebar')}
              onOpen={(id) => navigate(docsHref(id, source))}
            />
            <div className="api-docs__content">
              <OperationMain
                op={current}
                doc={doc}
                apiBase={apiBase}
                source={source}
                onTry={() => setTryOpen(true)}
              />
              <OperationAside op={current} doc={doc} apiBase={apiBase} source={source} />
            </div>
          </div>
          {tryOpen && current && doc ? (
            <TryItPlayground
              op={current}
              ops={ops}
              doc={doc}
              requestOrigin={requestOriginFor(source)}
              sessionAuth={source === 'os'}
              onClose={() => setTryOpen(false)}
              onSelectOp={(id) => navigate(docsHref(id, source))}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span className={cn('api-docs__method', `api-docs__method--${method}`)}>
      {method}
    </span>
  );
}

function osOrigin(): string {
  if (typeof window === 'undefined') return 'http://127.0.0.1:3100';
  return window.location.origin;
}

function requestOriginFor(source: DocsSource): string | undefined {
  if (source === 'os') return osOrigin();
  if (source === 'cloud') return CLOUD_API_BASE;
  return undefined;
}

function absoluteApiUrl(path: string, apiBase: string | null): string {
  if (!apiBase) return gatewayAbsoluteUrl(path);
  const relative = path.startsWith('/') ? path : `/${path}`;
  return `${apiBase}${relative}`;
}

function PathDisplay({ path, apiBase }: { path: string; apiBase: string | null }) {
  const origin = apiBase ?? gatewayOrigin();
  const relative = path.startsWith('/') ? path : `/${path}`;
  const parts = relative.split(/(\{[^}]+\})/g);
  const full = absoluteApiUrl(path, apiBase);
  return (
    <div className="api-docs__endpoint-path" title={full}>
      <span className="api-docs__endpoint-base">{origin}</span>
      {parts.map((part, i) =>
        part.startsWith('{') ? (
          <span key={i} className="api-docs__endpoint-param">
            {part}
          </span>
        ) : (
          <span key={i} className="api-docs__endpoint-seg">
            {part}
          </span>
        ),
      )}
    </div>
  );
}

function OperationMain({
  op,
  doc,
  apiBase,
  source,
  onTry,
}: {
  op: ApiOperation;
  doc: OpenApiDocument;
  apiBase: string | null;
  source: DocsSource;
  onTry: () => void;
}) {
  const { t, locale } = useI18n();
  const title = operationTitle(op, locale);
  const group = groupLabel(op.group, locale);
  const fullUrl = absoluteApiUrl(op.path, apiBase);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const pathParams = op.parameters.filter((p) => p.in === 'path');
  const queryParams = op.parameters.filter((p) => p.in === 'query');
  const headerParams = op.parameters.filter((p) => p.in === 'header');
  const authParams: OpenApiParameter[] = op.hasBearerAuth
    ? [
        {
          name: 'Authorization',
          in: 'header',
          required: true,
          description: t(
            source === 'os'
              ? 'apiDocs.osBearerHint'
              : source === 'cloud'
                ? 'apiDocs.cloudBearerHint'
                : 'apiDocs.bearerHint',
          ),
          schema: { type: 'string' },
        },
      ]
    : [];

  async function copyFullUrl() {
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <main className="api-docs__main">
      <p className="api-docs__eyebrow">{group}</p>
      <div className="api-docs__title-row">
        <h1 className="api-docs__title">{title}</h1>
      </div>
      {op.description && textMatchesLocale(op.description, locale) ? (
        <p className="api-docs__desc">{op.description}</p>
      ) : op.description ? (
        <p className="api-docs__desc">
          <strong>{t('apiDocs.contractText')} · </strong>
          {op.description}
        </p>
      ) : (
        <p className="api-docs__desc">{t('apiDocs.noDescription')}</p>
      )}
      <p className="api-docs__desc api-docs__protocol-note">
        {t(
          source === 'os'
            ? 'apiDocs.osProtocolNote'
            : source === 'cloud'
              ? 'apiDocs.cloudProtocolNote'
              : 'apiDocs.protocolNote',
        )}
      </p>

      <div className="api-docs__endpoint">
        <MethodBadge method={op.method} />
        <PathDisplay path={op.path} apiBase={apiBase} />
        <button
          type="button"
          className="api-docs__ghost api-docs__endpoint-copy"
          onClick={() => void copyFullUrl()}
        >
          {copiedUrl ? t('apiDocs.copied') : t('apiDocs.copyUrl')}
        </button>
        <button type="button" className="api-docs__primary" onClick={onTry}>
          {t('apiDocs.tryIt')}
        </button>
      </div>

      <section className="api-docs__section api-docs__envelope">
        <h2 className="api-docs__section-title">{t('apiDocs.envelopeTitle')}</h2>
        <p className="api-docs__desc">{t('apiDocs.envelopeBody')}</p>
        <HighlightedCode
          code={`{
  "success": true,
  "code": 0,
  "message": "OK",
  "data": { /* ${locale === 'zh' ? '业务载荷' : 'payload'} */ },
  "request_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "timestamp": "2026-09-18T06:42:00.123Z"
}`}
          language="json"
        />
      </section>

      {authParams.length ? (
        <section className="api-docs__section">
          <h2 className="api-docs__section-title">{t('apiDocs.auth')}</h2>
          {authParams.map((p) => (
            <ParamRow key={p.name} param={p} doc={doc} />
          ))}
        </section>
      ) : null}

      {pathParams.length ? (
        <section className="api-docs__section">
          <h2 className="api-docs__section-title">{t('apiDocs.pathParams')}</h2>
          {pathParams.map((p) => (
            <ParamRow key={p.name} param={p} doc={doc} />
          ))}
        </section>
      ) : null}

      {queryParams.length ? (
        <section className="api-docs__section">
          <h2 className="api-docs__section-title">{t('apiDocs.queryParams')}</h2>
          {queryParams.map((p) => (
            <ParamRow key={p.name} param={p} doc={doc} />
          ))}
        </section>
      ) : null}

      {headerParams.length ? (
        <section className="api-docs__section">
          <h2 className="api-docs__section-title">{t('apiDocs.headerParams')}</h2>
          {headerParams.map((p) => (
            <ParamRow key={`${p.name}-${p.in}`} param={p} doc={doc} />
          ))}
        </section>
      ) : null}

      {op.requestBody ? (
        <section className="api-docs__section">
          <h2 className="api-docs__section-title">{t('apiDocs.body')}</h2>
          <div className="api-docs__param">
            <div className="api-docs__param-head">
              <span className="api-docs__param-name">application/json</span>
              <span className="api-docs__param-meta">body</span>
              {op.requestBody.required ? (
                <span className="api-docs__required">{t('apiDocs.required')}</span>
              ) : null}
            </div>
            {op.requestBody.description ? (
              <p className="api-docs__param-desc">{op.requestBody.description}</p>
            ) : null}
          </div>
        </section>
      ) : null}

      {Object.keys(op.responses).length ? (
        <section className="api-docs__section">
          <h2 className="api-docs__section-title">{t('apiDocs.responses')}</h2>
          {Object.entries(op.responses).map(([status, response]) => {
            const schema = response.content?.['application/json']?.schema;
            return (
              <div key={status} className="api-docs__param">
                <div className="api-docs__param-head">
                  <span className="api-docs__param-name">{status}</span>
                  <span className="api-docs__param-meta">
                    {schemaTypeLabel(schema, doc)}
                  </span>
                </div>
                {response.description ? (
                  <p className="api-docs__param-desc">{response.description}</p>
                ) : null}
              </div>
            );
          })}
        </section>
      ) : null}
    </main>
  );
}

function ParamRow({
  param,
  doc,
}: {
  param: OpenApiParameter;
  doc: OpenApiDocument;
}) {
  const { t, locale } = useI18n();
  const description = param.description?.trim() ?? '';
  const showContract = description && !textMatchesLocale(description, locale);
  return (
    <div className="api-docs__param">
      <div className="api-docs__param-head">
        <span className="api-docs__param-name">{param.name}</span>
        <span className="api-docs__param-meta">
          {schemaTypeLabel(param.schema, doc)}
        </span>
        <span className="api-docs__param-meta">{param.in}</span>
        {param.required ? (
          <span className="api-docs__required">{t('apiDocs.required')}</span>
        ) : null}
      </div>
      {description ? (
        <p className="api-docs__param-desc">
          {showContract ? <strong>{t('apiDocs.contractText')} · </strong> : null}
          {description}
        </p>
      ) : null}
    </div>
  );
}

function OperationAside({
  op,
  doc,
  apiBase,
  source,
}: {
  op: ApiOperation;
  doc: OpenApiDocument;
  apiBase: string | null;
  source: DocsSource;
}) {
  const { t, locale } = useI18n();
  const [lang, setLang] = useState<CodeLang>('curl');
  const [copied, setCopied] = useState(false);
  const [responseTab, setResponseTab] = useState<string | null>(null);
  const title = operationTitle(op, locale);

  const pathValues: Record<string, string> = {};
  for (const p of op.parameters.filter((x) => x.in === 'path')) {
    pathValues[p.name] = `<${p.name}>`;
  }
  const urlPath = buildRequestUrl(op.path, pathValues, {});
  const absoluteHint = absoluteApiUrl(urlPath, apiBase);

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  if (op.hasBearerAuth) {
    headers.Authorization =
      source === 'os'
        ? 'Bearer <a3s_us_ 或 a3s_ms_>'
        : source === 'cloud'
          ? 'Bearer <a3s_…>'
          : 'Bearer <capability-key>';
  }
  const body =
    op.requestBody && op.method !== 'get'
      ? defaultBodyExample(op, doc)
      : undefined;
  if (body) headers['Content-Type'] = 'application/json';

  const code = generateCode(lang, {
    method: op.method,
    url: absoluteHint,
    headers,
    body,
  });

  const responses = responseExamples(op, doc);
  const activeResponse =
    responses.find((r) => r.status === responseTab) ??
    responses.find((r) => r.status.startsWith('2')) ??
    responses[0] ??
    null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="api-docs__examples" aria-label={t('apiDocs.examples')}>
      <div className="api-docs__card">
        <div className="api-docs__card-head">
          <span>{title}</span>
          <div className="api-docs__card-actions">
            <LangSelect
              value={lang}
              onChange={setLang}
              label={t('apiDocs.language')}
            />
            <button type="button" onClick={() => void copy()}>
              {copied ? t('apiDocs.copied') : t('apiDocs.copy')}
            </button>
          </div>
        </div>
        <HighlightedCode code={code} language={highlightLangFor(lang)} />
      </div>

      {activeResponse ? (
        <div className="api-docs__card api-docs__card--response">
          <div className="api-docs__card-head">
            <div className="api-try__tabs" role="tablist">
              {responses.map((r) => (
                <button
                  key={r.status}
                  type="button"
                  role="tab"
                  aria-selected={r.status === activeResponse.status}
                  className={cn(
                    'api-try__tab',
                    r.status === activeResponse.status && 'is-active',
                    r.status.startsWith('2') && 'is-ok',
                    (r.status.startsWith('4') || r.status.startsWith('5')) &&
                      'is-err',
                  )}
                  onClick={() => setResponseTab(r.status)}
                >
                  {r.status}
                </button>
              ))}
            </div>
          </div>
          <HighlightedCode code={activeResponse.body} language="json" />
        </div>
      ) : null}
    </section>
  );
}

function EndpointTree({
  groups,
  locale,
  currentId,
  emptyLabel,
  ariaLabel,
  onOpen,
}: {
  groups: Array<{ group: string; items: ApiOperation[] }>;
  locale: 'zh' | 'en';
  currentId: string;
  emptyLabel: string;
  ariaLabel: string;
  onOpen: (id: string) => void;
}) {
  const tree = useMemo(() => buildSideCatalog(groups, locale), [groups, locale]);
  const branches = useMemo(() => catalogBranchIds(tree), [tree]);
  const branchKey = branches.join('\0');
  const [collapsed, setCollapsed] = useState<{ key: string; ids: Set<string> } | null>(null);
  const open = useMemo(() => {
    const ids = new Set(branches);
    if (collapsed?.key === branchKey) {
      for (const id of collapsed.ids) ids.delete(id);
    }
    return ids;
  }, [branches, branchKey, collapsed]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const ids = new Set(prev?.key === branchKey ? prev.ids : []);
      if (ids.has(id)) ids.delete(id);
      else ids.add(id);
      return { key: branchKey, ids };
    });
  }

  return (
    <aside className="api-docs__tree" aria-label={ariaLabel}>
      {tree.length ? (
        <TreeBranches
          nodes={tree}
          depth={0}
          open={open}
          currentId={currentId}
          onToggle={toggle}
          onOpen={onOpen}
        />
      ) : (
        <div className="api-docs__empty">{emptyLabel}</div>
      )}
    </aside>
  );
}

function TreeBranches({
  nodes,
  depth,
  open,
  currentId,
  onToggle,
  onOpen,
}: {
  nodes: CatalogNode[];
  depth: number;
  open: Set<string>;
  currentId: string;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}) {
  return nodes.map((node) => {
    const pad = { paddingLeft: `${0.5 + depth * 0.85}rem` };
    if (node.operation) {
      return (
        <button
          key={node.id}
          type="button"
          className={cn('api-docs__nav-item', node.operation.id === currentId && 'is-active')}
          style={pad}
          ref={node.operation.id === currentId ? scrollActiveIntoView : undefined}
          onClick={() => onOpen(node.operation!.id)}
        >
          <MethodBadge method={node.operation.method} />
          <span className="api-docs__nav-label">{node.label}</span>
        </button>
      );
    }
    const expanded = open.has(node.id);
    return (
      <div key={node.id}>
        <button
          type="button"
          className="api-docs__tree-branch"
          style={pad}
          aria-expanded={expanded}
          onClick={() => onToggle(node.id)}
        >
          <TreeChevron open={expanded} />
          <span className="api-docs__nav-label">{node.label}</span>
          <span className="api-docs__tree-count">{countCatalogOperations(node)}</span>
        </button>
        {expanded ? (
          <TreeBranches
            nodes={node.children}
            depth={depth + 1}
            open={open}
            currentId={currentId}
            onToggle={onToggle}
            onOpen={onOpen}
          />
        ) : null}
      </div>
    );
  });
}

function scrollActiveIntoView(node: HTMLButtonElement | null) {
  node?.scrollIntoView({ block: 'nearest' });
}

function TreeChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('api-docs__tree-chevron', open && 'is-open')}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden
    >
      <path
        d="M4.25 2.5 7.75 6l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
