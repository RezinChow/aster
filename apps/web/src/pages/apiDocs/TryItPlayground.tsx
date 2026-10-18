import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { SearchSelect, cn } from '@a3s-lab/ui';
import {
  listEnabledDebugClientKeys,
  maskDebugClientSecret,
} from '@/data/debugClientKeys';
import { useI18n } from '@/i18n/useI18n';
import {
  gatewayAbsoluteUrl,
  gatewayBaseUrl,
  gatewayPathUnderV1,
  isPlaceholderGatewayBase,
  parseToolSkuFromPath,
  subscribeGatewayBaseUrl,
  isConsoleToolInvokePreview,
} from '@/lib/workConnect';
import { gatewayInvokeListing } from '@/data/gatewayInvoke';
import {
  resolveRef,
  schemaTypeLabel,
  type ApiOperation,
  type OpenApiDocument,
  type OpenApiParameter,
  type OpenApiSchema,
} from '@/lib/openapi';
import {
  buildRequestUrl,
  defaultBodyExample,
  firstResponseExample,
  generateCode,
  highlightLangFor,
  type CodeLang,
} from './codegen';
import { HighlightedCode } from './HighlightedCode';
import { LangSelect } from './LangSelect';
import { matchesOperationQuery, operationTitle } from './labels';

type TryResult = {
  status: number;
  statusText: string;
  body: string;
};

type SectionKey = 'auth' | 'path' | 'query' | 'header' | 'body';

export function TryItPlayground({
  op,
  ops,
  doc,
  requestOrigin,
  sessionAuth = false,
  onClose,
  onSelectOp,
}: {
  op: ApiOperation;
  ops: ApiOperation[];
  doc: OpenApiDocument;
  /** Same-origin base for a3s-api routes. Gateway resolution stays unused. */
  requestOrigin?: string;
  sessionAuth?: boolean;
  onClose: () => void;
  onSelectOp: (id: string) => void;
}) {
  const { t, locale } = useI18n();
  const title = operationTitle(op, locale);

  const pathParams = op.parameters.filter((p) => p.in === 'path');
  const queryParams = op.parameters.filter((p) => p.in === 'query');
  const headerParams = op.parameters.filter((p) => p.in === 'header');
  const bodyProps = useMemo(() => bodyPropertyFields(op, doc), [op, doc]);

  const [pathValues, setPathValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [headerValues, setHeaderValues] = useState<Record<string, string>>({});
  const [bearer, setBearer] = useState('');
  const [debugKeyId, setDebugKeyId] = useState('');
  const [body, setBody] = useState(() => defaultBodyExample(op, doc));
  const [bodyFields, setBodyFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TryResult | null>(null);
  const [lang, setLang] = useState<CodeLang>('javascript');
  const [copied, setCopied] = useState<'code' | 'response' | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    auth: true,
    path: true,
    query: true,
    header: false,
    body: true,
  });
  const [responseTab, setResponseTab] = useState<string>('live');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [gatewayTick, setGatewayTick] = useState(0);

  useEffect(() => {
    return subscribeGatewayBaseUrl(() => setGatewayTick((n) => n + 1));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    const path = op.parameters.filter((p) => p.in === 'path');
    const query = op.parameters.filter((p) => p.in === 'query');
    const header = op.parameters.filter((p) => p.in === 'header');
    setPathValues(seedParamValues(path, doc));
    setQueryValues(seedParamValues(query, doc));
    setHeaderValues(seedParamValues(header, doc));
    const keys = listEnabledDebugClientKeys();
    const first = keys[0];
    if (first) {
      setDebugKeyId(first.id);
      setBearer(first.secret);
    } else {
      setBearer('');
      setDebugKeyId('');
    }
    const example = defaultBodyExample(op, doc);
    setBody(example);
    setBodyFields(parseBodyFields(example, bodyProps));
    setResult(null);
    // Always open on live result pane — schema examples are easy to mistake for
    // a real response (e.g. market placeholder `{ ok: true }`).
    setResponseTab('live');
    setPickerOpen(false);
    setPickerQuery('');
    setOpenSections({
      auth: true,
      path: true,
      query: query.length > 0,
      header: false,
      body: Boolean(op.requestBody),
    });
  }, [op, doc, bodyProps]);

  const debugKeys = listEnabledDebugClientKeys();
  const debugKeyOptions = useMemo(
    () => [
      { value: '', label: t('apiDocs.debugKeyManual') },
      ...debugKeys.map((k) => ({
        value: k.id,
        label: `${k.label} · ${maskDebugClientSecret(k.secret)}`,
      })),
    ],
    [debugKeys, t],
  );

  const filteredPickerOps = useMemo(
    () => ops.filter((item) => matchesOperationQuery(item, pickerQuery, locale)),
    [ops, pickerQuery, locale],
  );

  const requestBodyText = useMemo(() => {
    if (!op.requestBody) return undefined;
    if (bodyProps.length) {
      const obj: Record<string, unknown> = {};
      for (const field of bodyProps) {
        const raw = bodyFields[field.name] ?? '';
        obj[field.name] = coerceFieldValue(raw, field.schema);
      }
      return JSON.stringify(obj, null, 2);
    }
    return body || undefined;
  }, [op.requestBody, bodyProps, bodyFields, body]);

  const requestUrl = useMemo(() => {
    const path = buildRequestUrl(op.path, pathValues, queryValues);
    return path.startsWith('/') ? path : `/${path}`;
  }, [op.path, pathValues, queryValues]);

  const absoluteUrl = useMemo(() => {
    if (requestOrigin) {
      const base = requestOrigin.replace(/\/$/, '');
      return `${base}${requestUrl.startsWith('/') ? requestUrl : `/${requestUrl}`}`;
    }
    void gatewayTick;
    return gatewayAbsoluteUrl(requestUrl);
  }, [requestUrl, gatewayTick, requestOrigin]);

  const placeholderGateway = useMemo(() => {
    void gatewayTick;
    return isPlaceholderGatewayBase();
  }, [gatewayTick]);

  const consoleToolPreview = useMemo(() => {
    void gatewayTick;
    return isConsoleToolInvokePreview();
  }, [gatewayTick]);

  const pathChipBase = useMemo(() => {
    void gatewayTick;
    return gatewayBaseUrl();
  }, [gatewayTick]);

  const requestHeaders = useMemo(() => {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (op.hasBearerAuth) {
      headers.Authorization = bearer.trim()
        ? bearer.trim().startsWith('Bearer ')
          ? bearer.trim()
          : `Bearer ${bearer.trim()}`
        : 'Bearer <capability-key>';
    }
    for (const [key, value] of Object.entries(headerValues)) {
      if (value) headers[key] = value;
    }
    if (
      requestBodyText &&
      op.method !== 'get' &&
      op.method !== 'head'
    ) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }, [
    op.hasBearerAuth,
    op.method,
    bearer,
    headerValues,
    requestBodyText,
  ]);

  const code = useMemo(() => {
    const payload =
      requestBodyText && op.method !== 'get' && op.method !== 'head'
        ? requestBodyText
        : undefined;
    return generateCode(lang, {
      method: op.method,
      url: absoluteUrl,
      headers: requestHeaders,
      body: payload,
    });
  }, [lang, op.method, absoluteUrl, requestHeaders, requestBodyText]);

  const schemaResponses = useMemo(() => {
    return Object.entries(op.responses).map(([status, response]) => {
      const json = response.content?.['application/json'];
      let bodyText = '';
      if (json?.example !== undefined) {
        bodyText = JSON.stringify(json.example, null, 2);
      } else {
        const fallback = firstResponseExample(
          { ...op, responses: { [status]: response } },
          doc,
        );
        bodyText =
          fallback?.body ??
          JSON.stringify({ description: response.description }, null, 2);
      }
      return { status, body: bodyText };
    });
  }, [op, doc]);

  const activeResponseBody =
    responseTab === 'live'
      ? (result?.body ?? t('apiDocs.tryEmptyResponse'))
      : (schemaResponses.find((r) => r.status === responseTab)?.body ?? '');

  async function send() {
    setBusy(true);
    setResult(null);
    setResponseTab('live');
    try {
      const sku = parseToolSkuFromPath(requestUrl);
      if (sku) {
        const input = parseToolInvokeInput(requestBodyText, queryValues);
        const cred = bearer.trim().replace(/^Bearer\s+/i, '');
        const res = await gatewayInvokeListing({
          sku,
          input,
          capabilityKey: cred || undefined,
          credentialPrefix: cred
            ? cred.slice(0, 14) || 'a3s_sk_work'
            : 'a3s_sk_work',
          forcePreview: isConsoleToolInvokePreview(),
        });
        if (res.ok) {
          setResult({
            status: 200,
            statusText: res.preview ? 'OK (preview)' : 'OK',
            body: JSON.stringify(
              {
                success: true,
                code: 0,
                message: res.preview ? 'OK (Console preview)' : 'OK',
                data: {
                  ok: true,
                  path: res.path,
                  result: res.result,
                  usageId: res.usageId,
                  preview: res.preview === true,
                },
                request_id: res.requestId,
                timestamp: new Date().toISOString(),
              },
              null,
              2,
            ),
          });
        } else {
          setResult({
            status: res.httpStatus,
            statusText: res.code,
            body: JSON.stringify(
              {
                success: false,
                code: res.httpStatus * 100,
                message: res.message,
                data: null,
                errors: [{ field: 'sku', message: res.code }],
                request_id: res.requestId,
                timestamp: new Date().toISOString(),
                preview: res.preview === true,
              },
              null,
              2,
            ),
          });
        }
        return;
      }

      const headers: Record<string, string> = {
        accept: 'application/json',
      };
      for (const [key, value] of Object.entries(headerValues)) {
        if (value) headers[key] = value;
      }
      if (
        requestBodyText &&
        op.method !== 'get' &&
        op.method !== 'head'
      ) {
        headers['content-type'] = 'application/json';
      }
      const token = bearer.trim();
      if (token) {
        headers.authorization = token.startsWith('Bearer ')
          ? token
          : `Bearer ${token}`;
      }

      const response = await fetch(absoluteUrl, {
        method: op.method.toUpperCase(),
        headers,
        body:
          requestBodyText && op.method !== 'get' && op.method !== 'head'
            ? requestBodyText
            : undefined,
      });
      const text = await response.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* keep */
      }
      setResult({
        status: response.status,
        statusText: response.statusText,
        body: pretty,
      });
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const hint =
        raw === 'Failed to fetch' || /NetworkError|network/i.test(raw)
          ? [
              raw,
              '',
              'Local Work path is Console → Gateway :8080 → Function :8787.',
              '1) just runtime   # HOST=0.0.0.0 PORT=8787',
              '2) just up         # refresh a3s-api and a3s-gateway after ACL changes',
              '3) Capability Key: a3s_sk_devlocalgateway00000000000001',
              `4) Target URL: ${absoluteUrl}`,
            ].join('\n')
          : raw;
      setResult({
        status: 0,
        statusText: 'Network Error',
        body: hint,
      });
    } finally {
      setBusy(false);
    }
  }

  async function copyText(kind: 'code' | 'response', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1200);
    } catch {
      /* ignore */
    }
  }

  function toggleSection(key: SectionKey) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return createPortal(
    <div className="api-try-modal" role="presentation">
      <button
        type="button"
        className="api-try-modal__backdrop"
        aria-label={t('apiDocs.closeTry')}
        onClick={onClose}
      />
      <div
        className="api-try"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="api-try__bar">
          <div className="api-try__picker-wrap">
            <button
              type="button"
              className="api-try__picker"
              aria-expanded={pickerOpen}
              onClick={() =>
                setPickerOpen((v) => {
                  const next = !v;
                  if (next) setPickerQuery('');
                  return next;
                })
              }
            >
              <MethodBadge method={op.method} />
              <span className="api-try__picker-title">{title}</span>
              <Chevron open={pickerOpen} />
            </button>
            {pickerOpen ? (
              <div className="api-try__picker-menu" role="listbox">
                <div className="api-try__picker-search">
                  <SearchIcon />
                  <input
                    autoFocus
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder={t('apiDocs.searchEndpoints')}
                    aria-label={t('apiDocs.searchEndpoints')}
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  />
                </div>
                <div className="api-try__picker-list">
                  {filteredPickerOps.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={item.id === op.id}
                      className={cn(
                        'api-try__picker-item',
                        item.id === op.id && 'is-active',
                      )}
                      onClick={() => {
                        onSelectOp(item.id);
                        setPickerOpen(false);
                        setPickerQuery('');
                      }}
                    >
                      <MethodBadge method={item.method} />
                      <span>{operationTitle(item, locale)}</span>
                    </button>
                  ))}
                  {!filteredPickerOps.length ? (
                    <div className="api-try__picker-empty">
                      {t('apiDocs.noMatches')}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="api-try__bar-path" title={absoluteUrl}>
            <span
              className={cn(
                'api-try__bar-verb',
                `api-try__bar-verb--${op.method}`,
              )}
            >
              {op.method.toUpperCase()}
            </span>
            <PathChips
              path={requestOrigin ? op.path : gatewayPathUnderV1(op.path)}
              values={pathValues}
              base={requestOrigin ?? pathChipBase}
            />
          </div>

          <div className="api-try__bar-actions">
            <button
              type="button"
              className="api-try__send"
              disabled={busy}
              onClick={() => void send()}
            >
              <PlayIcon />
              {busy ? t('apiDocs.sending') : t('apiDocs.send')}
            </button>
          </div>
        </header>

        <div className="api-try__grid">
          <div className="api-try__params">
            <div className="api-try__params-head">
              <h2 className="api-try__heading">{title}</h2>
              <p className="api-try__lead">
                {op.description?.trim() ||
                  op.summary?.trim() ||
                  t('apiDocs.noDescription')}
              </p>
              {requestOrigin ? null : placeholderGateway ? (
                <p className="mt-2 text-[11px] leading-relaxed text-[color:var(--color-warning,#b45309)]">
                  {t('apiDocs.gatewayPlaceholder')}{' '}
                  <Link
                    to="/admin/settings/debug"
                    className="underline-offset-2 hover:underline"
                    onClick={onClose}
                  >
                    {t('apiDocs.gatewayConfigure')}
                  </Link>
                </p>
              ) : consoleToolPreview ? (
                <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                  {t('apiDocs.gatewayConsolePreview')}
                </p>
              ) : null}
            </div>

            {op.hasBearerAuth ? (
              <ParamSection
                title={t('apiDocs.auth')}
                open={openSections.auth}
                onToggle={() => toggleSection('auth')}
              >
                <div className="space-y-2 px-1 pb-1">
                  <p className="text-[11px] leading-relaxed text-ink-faint">
                    {t(sessionAuth ? 'apiDocs.osBearerHint' : 'apiDocs.bearerHint')}
                    {sessionAuth ? null : (
                      <>
                        {' '}
                        <Link
                          to="/admin/settings/debug"
                          className="text-ink underline-offset-2 hover:underline"
                          onClick={onClose}
                        >
                          {t('apiDocs.debugKeyManage')}
                        </Link>
                      </>
                    )}
                  </p>
                  {sessionAuth ? null : (
                  <div className="space-y-1">
                    <span className="text-[11px] font-medium text-ink-muted">
                      {t('apiDocs.debugKeyPick')}
                    </span>
                    <SearchSelect
                      size="sm"
                      searchable={debugKeys.length > 6}
                      allowClear={false}
                      value={debugKeyId}
                      options={debugKeyOptions}
                      placeholder={
                        debugKeys.length === 0
                          ? t('apiDocs.debugKeyEmpty')
                          : t('apiDocs.debugKeyPickPh')
                      }
                      emptyText={t('apiDocs.debugKeyEmpty')}
                      onChange={(id) => {
                        setDebugKeyId(id);
                        if (!id) {
                          setBearer('');
                          return;
                        }
                        const hit = debugKeys.find((k) => k.id === id);
                        if (hit) setBearer(hit.secret);
                      }}
                      aria-label={t('apiDocs.debugKeyPick')}
                    />
                  </div>
                  )}
                </div>
                <EditableParam
                  name="Authorization"
                  typeLabel="string <bearer>"
                  required
                  value={bearer}
                  placeholder={t(
                    sessionAuth ? 'apiDocs.osBearerPlaceholder' : 'apiDocs.bearerPlaceholder',
                  )}
                  onChange={(value) => {
                    setDebugKeyId('');
                    setBearer(value);
                  }}
                />
              </ParamSection>
            ) : null}

            {pathParams.length ? (
              <ParamSection
                title={t('apiDocs.pathShort')}
                open={openSections.path}
                onToggle={() => toggleSection('path')}
              >
                {pathParams.map((p) => (
                  <EditableParam
                    key={p.name}
                    name={p.name}
                    typeLabel={schemaTypeLabel(p.schema, doc)}
                    required={Boolean(p.required)}
                    description={p.description}
                    value={pathValues[p.name] ?? ''}
                    placeholder={t('apiDocs.enterParam').replace(
                      '{name}',
                      p.name,
                    )}
                    onChange={(value) =>
                      setPathValues((prev) => ({ ...prev, [p.name]: value }))
                    }
                  />
                ))}
              </ParamSection>
            ) : null}

            {queryParams.length ? (
              <ParamSection
                title={t('apiDocs.queryShort')}
                open={openSections.query}
                onToggle={() => toggleSection('query')}
              >
                {queryParams.map((p) => (
                  <EditableParam
                    key={p.name}
                    name={p.name}
                    typeLabel={schemaTypeLabel(p.schema, doc)}
                    required={Boolean(p.required)}
                    description={p.description}
                    value={queryValues[p.name] ?? ''}
                    placeholder={t('apiDocs.enterParam').replace(
                      '{name}',
                      p.name,
                    )}
                    onChange={(value) =>
                      setQueryValues((prev) => ({ ...prev, [p.name]: value }))
                    }
                  />
                ))}
              </ParamSection>
            ) : null}

            {headerParams.length ? (
              <ParamSection
                title={t('apiDocs.headerParams')}
                open={openSections.header}
                onToggle={() => toggleSection('header')}
              >
                {headerParams.map((p) => (
                  <EditableParam
                    key={p.name}
                    name={p.name}
                    typeLabel={schemaTypeLabel(p.schema, doc)}
                    required={Boolean(p.required)}
                    description={p.description}
                    value={headerValues[p.name] ?? ''}
                    placeholder={t('apiDocs.enterParam').replace(
                      '{name}',
                      p.name,
                    )}
                    onChange={(value) =>
                      setHeaderValues((prev) => ({ ...prev, [p.name]: value }))
                    }
                  />
                ))}
              </ParamSection>
            ) : null}

            {op.requestBody ? (
              <ParamSection
                title={t('apiDocs.body')}
                open={openSections.body}
                onToggle={() => toggleSection('body')}
              >
                {bodyProps.length ? (
                  bodyProps.map((field) => (
                    <EditableParam
                      key={field.name}
                      name={field.name}
                      typeLabel={schemaTypeLabel(field.schema, doc)}
                      required={field.required}
                      description={field.description}
                      value={bodyFields[field.name] ?? ''}
                      placeholder={t('apiDocs.enterParam').replace(
                        '{name}',
                        field.name,
                      )}
                      multiline={field.multiline}
                      onChange={(value) =>
                        setBodyFields((prev) => ({
                          ...prev,
                          [field.name]: value,
                        }))
                      }
                    />
                  ))
                ) : (
                  <textarea
                    className="api-try__textarea"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    spellCheck={false}
                  />
                )}
              </ParamSection>
            ) : null}
          </div>

          <div className="api-try__aside">
            <div className="api-try__card">
              <div className="api-try__card-head">
                <span className="api-try__card-title">{title}</span>
                <div className="api-try__card-actions">
                  <LangSelect
                    value={lang}
                    onChange={setLang}
                    label={t('apiDocs.language')}
                  />
                  <button
                    type="button"
                    className="api-try__icon-btn"
                    aria-label={
                      copied === 'code' ? t('apiDocs.copied') : t('apiDocs.copy')
                    }
                    onClick={() => void copyText('code', code)}
                  >
                    {copied === 'code' ? <CheckIcon /> : <CopyIcon />}
                  </button>
                </div>
              </div>
              <HighlightedCode
                code={code}
                language={highlightLangFor(lang)}
                className="api-try__code"
              />
            </div>

            <div className="api-try__card api-try__card--response">
              <div className="api-try__card-head">
                <div className="api-try__tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    className={cn(
                      'api-try__tab',
                      responseTab === 'live' && 'is-active',
                      result &&
                        result.status >= 200 &&
                        result.status < 300 &&
                        'is-ok',
                      result &&
                        (result.status === 0 || result.status >= 400) &&
                        'is-err',
                    )}
                    onClick={() => setResponseTab('live')}
                  >
                    {result
                      ? String(result.status || 'ERR')
                      : t('apiDocs.tryLive')}
                  </button>
                  {schemaResponses.map((r) => (
                    <button
                      key={r.status}
                      type="button"
                      role="tab"
                      className={cn(
                        'api-try__tab',
                        responseTab === r.status && 'is-active',
                      )}
                      onClick={() => setResponseTab(r.status)}
                      title={t('apiDocs.trySchemaHint')}
                    >
                      {locale === 'zh'
                        ? `示例 ${r.status}`
                        : `Example ${r.status}`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="api-try__icon-btn"
                  aria-label={
                    copied === 'response'
                      ? t('apiDocs.copied')
                      : t('apiDocs.copy')
                  }
                  onClick={() => void copyText('response', activeResponseBody)}
                >
                  {copied === 'response' ? <CheckIcon /> : <CopyIcon />}
                </button>
              </div>
              <HighlightedCode
                code={activeResponseBody}
                language={
                  activeResponseBody.trim().startsWith('{') ||
                  activeResponseBody.trim().startsWith('[')
                    ? 'json'
                    : 'plaintext'
                }
                className="api-try__code"
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function seedParamValues(
  params: OpenApiParameter[],
  doc: OpenApiDocument,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of params) {
    const schema = resolveRef(p.schema, doc);
    const example = schema?.example ?? p.schema?.example;
    if (example === undefined || example === null) continue;
    out[p.name] =
      typeof example === 'string' ? example : JSON.stringify(example);
  }
  return out;
}

function parseToolInvokeInput(
  bodyText: string | undefined,
  queryValues: Record<string, string>,
): Record<string, unknown> {
  let input: Record<string, unknown> = {};
  if (bodyText?.trim()) {
    try {
      const parsed = JSON.parse(bodyText) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        if (
          obj.input &&
          typeof obj.input === 'object' &&
          !Array.isArray(obj.input)
        ) {
          input = { ...(obj.input as Record<string, unknown>) };
        } else {
          input = { ...obj };
        }
      }
    } catch {
      /* ignore malformed body */
    }
  }
  for (const [key, value] of Object.entries(queryValues)) {
    if (value !== '') input[key] = value;
  }
  return input;
}

function bodyPropertyFields(
  op: ApiOperation,
  doc: OpenApiDocument,
): {
  name: string;
  schema?: OpenApiSchema;
  required: boolean;
  description?: string;
  multiline: boolean;
}[] {
  const json = op.requestBody?.content?.['application/json'];
  const schema = resolveRef(json?.schema, doc);
  if (!schema?.properties || typeof schema.properties !== 'object') return [];
  const required = new Set(schema.required ?? []);
  return Object.entries(schema.properties).map(([name, raw]) => {
    const prop = resolveRef(raw as OpenApiSchema, doc);
    const type = prop?.type;
    return {
      name,
      schema: prop,
      required: required.has(name),
      description: prop?.description,
      multiline:
        type === 'object' ||
        type === 'array' ||
        name.toLowerCase().includes('prompt') ||
        name.toLowerCase().includes('content') ||
        name.toLowerCase().includes('body'),
    };
  });
}

function parseBodyFields(
  example: string,
  fields: { name: string }[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of fields) out[field.name] = '';
  if (!example.trim() || !fields.length) return out;
  try {
    const parsed = JSON.parse(example) as Record<string, unknown>;
    for (const field of fields) {
      const value = parsed[field.name];
      if (value === undefined || value === null) continue;
      out[field.name] =
        typeof value === 'string' ? value : JSON.stringify(value);
    }
  } catch {
    /* keep empty */
  }
  return out;
}

function coerceFieldValue(raw: string, schema?: OpenApiSchema): unknown {
  if (raw === '') return schema?.type === 'string' ? '' : null;
  if (schema?.type === 'number' || schema?.type === 'integer') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (schema?.type === 'boolean') {
    if (raw === 'true') return true;
    if (raw === 'false') return false;
  }
  if (schema?.type === 'object' || schema?.type === 'array') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function ParamSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="api-try__section">
      <button
        type="button"
        className="api-try__section-toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>{title}</span>
        <Chevron open={open} />
      </button>
      {open ? <div className="api-try__section-body">{children}</div> : null}
    </section>
  );
}

function EditableParam({
  name,
  typeLabel,
  required,
  description,
  value,
  placeholder,
  onChange,
  multiline = false,
}: {
  name: string;
  typeLabel: string;
  required?: boolean;
  description?: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className={cn('api-try__param', multiline && 'api-try__param--multi')}>
      <div className="api-try__param-left">
        <div className="api-try__param-meta-row">
          <span className="api-docs__param-name">{name}</span>
          <span className="api-docs__param-meta">{typeLabel}</span>
          {required ? (
            <span className="api-docs__required">{t('apiDocs.required')}</span>
          ) : null}
        </div>
        {description ? (
          <p className="api-docs__param-desc">{description}</p>
        ) : null}
      </div>
      <div className="api-try__param-right">
        {multiline ? (
          <textarea
            className="api-try__textarea"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
            rows={4}
          />
        ) : (
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            spellCheck={false}
          />
        )}
      </div>
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

function PathChips({
  path,
  values,
  base,
}: {
  path: string;
  values: Record<string, string>;
  base?: string;
}) {
  const host = (base ?? '').replace(/\/$/, '');
  const parts = path.split('/').filter(Boolean);
  return (
    <div className="api-try__chips">
      {host ? <span className="api-try__chip-base">{host}</span> : null}
      {parts.map((part, i) => {
        const isParam = part.startsWith('{') && part.endsWith('}');
        const name = isParam ? part.slice(1, -1) : part;
        const filled = isParam ? values[name] : undefined;
        return (
          <span key={`${part}-${i}`} className="api-try__chip-wrap">
            <span className="api-try__chip-slash">/</span>
            <span
              className={cn(
                'api-try__chip',
                isParam && 'is-param',
                isParam && filled && 'is-filled',
                isParam && !filled && 'is-empty',
              )}
            >
              {isParam ? filled || part : part}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M8 5v14l11-7z" />
    </svg>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden
      className={cn('api-try__chevron', open && 'is-open')}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        d="m6 9 6 6 6-6"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M5 15V5a2 2 0 0 1 2-2h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
      <circle
        cx="11"
        cy="11"
        r="6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="m20 20-3.2-3.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
