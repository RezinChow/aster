import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Card, ConsoleFormField, Input, PageLoading } from '@a3s-lab/ui';
import { AppErrorBanner } from '@/components/AppErrorBanner';
import { useI18n } from '@/i18n/useI18n';
import type { MessageKey } from '@/i18n/messages';
import {
  getStoredOrgId,
  getUserToken,
  listOrgs,
  loginUser,
  setUserSession,
} from '@/lib/identityApi';
import { loginErrorKey } from '@/lib/loginError';
import { BrandMark, useBrandName } from '@/shell/BrandMark';

/** Dev / default host binds to the platform official Org; OEM later via subdomain. */
function pickLoginOrgId(orgs: Awaited<ReturnType<typeof listOrgs>>): string {
  const official = orgs.find((org) => org.is_official);
  if (official) return official.id;
  const byName = orgs.find(
    (org) => org.name === '官方组织' || org.name === 'Kense 官方',
  );
  return byName?.id || orgs[0]?.id || '';
}

export function LoginPage() {
  const { t } = useI18n();
  const brandName = useBrandName();
  const surfaceName = t('portal.entry.admin.title');
  const lockupLabel = `${brandName} ${surfaceName}`;
  const navigate = useNavigate();
  const formId = useId();

  const [orgId, setOrgId] = useState('');
  const [ready, setReady] = useState(false);
  const [booted, setBooted] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorKey, setErrorKey] = useState<MessageKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    password?: string;
  }>({});
  const [resolveKey, setResolveKey] = useState(0);

  useEffect(() => {
    if (ready) setBooted(true);
  }, [ready]);

  useEffect(() => {
    if (getUserToken()) {
      navigate('/admin/', { replace: true });
      return;
    }

    let cancelled = false;
    setReady(false);
    setErrorKey(null);

    void listOrgs()
      .then((items) => {
        if (cancelled) return;
        const next = pickLoginOrgId(items);
        setOrgId(next);
        if (!next) {
          setErrorKey('login.orgEmpty');
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const stored = getStoredOrgId();
        if (stored) {
          setOrgId(stored);
          setErrorKey(null);
          return;
        }
        setOrgId('');
        setErrorKey(loginErrorKey(err));
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });

    return () => {
      cancelled = true;
    };
    // resolveKey: manual retry; t/locale only affects empty-state copy after load.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + retry only
  }, [navigate, resolveKey]);

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (!email.trim()) next.email = t('login.emailRequired');
    if (password.length < 8) next.password = t('login.passwordRequired');
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!orgId) {
      setErrorKey('login.orgEmpty');
      return;
    }
    if (!validate()) return;
    setBusy(true);
    setErrorKey(null);
    try {
      const result = await loginUser({
        org_id: orgId,
        email: email.trim(),
        password,
      });
      setUserSession(result.token, result.user.org_id);
      window.localStorage.removeItem('kense.os.cloudProjectId');
      window.localStorage.removeItem('kense.os.cloudEnvId');
      navigate('/admin/', { replace: true });
    } catch (err) {
      setErrorKey(loginErrorKey(err));
    } finally {
      setBusy(false);
    }
  }

  if (!ready && !booted) {
    return <PageLoading variant="global" />;
  }

  return (
    <div className="os-login">
      <div className="os-login__atmosphere" aria-hidden />
      <main className="os-login__stage">
        <header className="os-login__brand">
          <Link to="/" className="os-login__brand-link" aria-label={lockupLabel}>
            <BrandMark wordmark size={40} tone="auto" alt="" />
            <span className="os-login__product">{surfaceName}</span>
          </Link>
        </header>

        <Card
          as="form"
          id={formId}
          className="os-login__panel"
          onSubmit={onSubmit}
          noValidate
          aria-busy={busy}
          aria-label={t('login.title')}
        >
          <p className="os-login__lead">{t('login.lead')}</p>
          {errorKey ? (
            <AppErrorBanner
              message={t(errorKey)}
              onRetry={
                !orgId
                  ? () => {
                      setResolveKey((k) => k + 1);
                    }
                  : undefined
              }
              retryLabel={t('login.retryOrgs')}
            />
          ) : null}

          <ConsoleFormField
            label={t('login.email')}
            error={fieldErrors.email}
            required
          >
            <Input
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              value={email}
              required
              disabled={busy || !orgId}
              placeholder={t('login.emailPlaceholder')}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
            />
          </ConsoleFormField>

          <ConsoleFormField
            label={t('login.password')}
            error={fieldErrors.password}
            required
          >
            <Input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              required
              minLength={8}
              disabled={busy || !orgId}
              placeholder={t('login.passwordPlaceholder')}
              onChange={(e) => {
                setPassword(e.target.value);
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
            />
          </ConsoleFormField>

          <Button
            type="submit"
            className="os-login__submit"
            disabled={busy || !orgId}
          >
            {busy ? t('login.submitting') : t('login.submit')}
          </Button>
        </Card>
      </main>
    </div>
  );
}
