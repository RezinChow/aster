import { describe, expect, test } from 'bun:test';
import {
  domainForDestination,
  matchDestination,
  OS_ACTIVITY_DOMAINS,
  OS_DESTINATIONS,
  OS_NAV_GROUPS,
} from './destinations';
import { translate } from '@/i18n/messages';

describe('sidebar layout', () => {
  const layout = () =>
    OS_NAV_GROUPS.map((group) => [
      group.id,
      group.sections.map((section) => [section.labelKey, section.items]),
    ]);

  test('operations, platform, and system split business, engineering, and administration', () => {
    expect(OS_ACTIVITY_DOMAINS.map((domain) => domain.id)).toEqual([
      'overview',
      'platform',
      'system',
    ]);
    expect(OS_ACTIVITY_DOMAINS.find((domain) => domain.id === 'system')).toMatchObject({
      icon: 'settings',
      defaultDestinationId: 'settingsSystem',
      labelKey: 'nav.group.system',
    });
    expect(layout()).toEqual([
      [
        'overview',
        [
          ['nav.section.dashboards', ['overview']],
          ['nav.section.business', ['subscriptions', 'orders', 'tasks']],
          ['nav.section.commercial', ['customers', 'channels', 'suppliers']],
          ['nav.section.ai', ['models', 'agents', 'applets', 'connectors', 'skills', 'plugins']],
        ],
      ],
      [
        'platform',
        [
          ['nav.section.dashboards', ['overviewPlatform']],
          ['nav.section.definitions', ['workflows', 'functions', 'agentRuntimes', 'cells']],
          ['nav.section.runtimePlane', ['gateway', 'fleet']],
          ['nav.section.observability', ['topology', 'events']],
        ],
      ],
      [
        'system',
        [
          ['settings.group.general', ['settingsSystem', 'settingsApps']],
          ['settings.group.team', ['users', 'positions', 'roles']],
          ['settings.group.security', ['settingsLogin', 'settingsCaptcha', 'settingsSms']],
          ['settings.group.config', ['settingsBootstrap', 'settingsEntries', 'settingsDebug']],
          ['settings.group.taxonomy', ['settingsIndustries', 'settingsChains', 'settingsTags']],
          [
            'settings.group.territory',
            ['settingsRegions', 'settingsAdministration', 'settingsParks', 'settingsUniversities'],
          ],
        ],
      ],
    ]);
  });

  test('each item lives in exactly one section and only dashboards hold a single link', () => {
    const ids = OS_NAV_GROUPS.flatMap((group) => group.sections.flatMap((section) => section.items));
    expect(new Set(ids).size).toBe(ids.length);
    for (const domain of OS_ACTIVITY_DOMAINS) {
      for (const locale of ['zh', 'en'] as const) {
        expect(translate(locale, domain.labelKey)).not.toBe(domain.labelKey);
      }
    }
    for (const group of OS_NAV_GROUPS) {
      for (const section of group.sections) {
        if (section.labelKey !== 'nav.section.dashboards') {
          expect(section.items.length).toBeGreaterThan(1);
        }
        for (const locale of ['zh', 'en'] as const) {
          expect(translate(locale, section.labelKey)).not.toBe(section.labelKey);
        }
      }
    }
  });

  test('sidebar follows the destination into its domain', () => {
    expect(domainForDestination('workflows')).toBe('platform');
    expect(domainForDestination('models')).toBe('overview');
    expect(domainForDestination('modelService')).toBe('overview');
    expect(domainForDestination('users')).toBe('system');
    expect(domainForDestination('settingsLogin')).toBe('system');
    expect(domainForDestination('settingsSystem')).toBe('system');
    expect(domainForDestination('settingsRegions')).toBe('system');
    expect(domainForDestination('settingsIndustries')).toBe('system');
  });
});

describe('route naming', () => {
  test('destinations use the renamed paths', () => {
    const paths = Object.fromEntries(Object.values(OS_DESTINATIONS).map((d) => [d.id, d.to]));
    expect(paths.overviewPlatform).toBe('/admin/platform');
    expect(paths.tasks).toBe('/admin/work-orders');
    expect(paths.agentRuntimes).toBe('/admin/agents');
    expect(paths.cells).toBe('/admin/cells');
    expect(paths.events).toBe('/admin/logs');
    expect(paths.users).toBe('/admin/team/members');
    expect(paths.positions).toBe('/admin/team/positions');
    expect(paths.roles).toBe('/admin/team/roles');
    expect(paths.settingsLogin).toBe('/admin/settings/sign-in');
    expect(paths.settingsEntries).toBe('/admin/settings/runtime');
  });

  test('every sidebar item matches its own path', () => {
    const ids = OS_NAV_GROUPS.flatMap((group) => group.sections.flatMap((section) => section.items));
    for (const id of ids) {
      expect(matchDestination(OS_DESTINATIONS[id].to.replace(/^\/admin/, '')).id).toBe(id);
    }
  });

  test('legacy paths still highlight the renamed destination', () => {
    const legacy: Array<[string, string]> = [
      ['/tasks', 'tasks'],
      ['/agent-runtimes', 'agentRuntimes'],
      ['/events', 'events'],
      ['/notifications', 'events'],
      ['/overview/platform', 'overviewPlatform'],
      ['/enterprise/members', 'users'],
      ['/enterprise/positions', 'positions'],
      ['/enterprise/roles', 'roles'],
      ['/settings/login', 'settingsLogin'],
      ['/settings/entries', 'settingsEntries'],
      ['/inference', 'models'],
      ['/model-service', 'models'],
      ['/market/models', 'models'],
    ];
    for (const [path, id] of legacy) {
      expect(matchDestination(path).id).toBe(id);
    }
  });

  test('every menu item has a label and description in both locales', () => {
    for (const destination of Object.values(OS_DESTINATIONS)) {
      for (const locale of ['zh', 'en'] as const) {
        expect(translate(locale, destination.labelKey)).not.toBe(destination.labelKey);
        expect(translate(locale, destination.descriptionKey)).not.toBe(destination.descriptionKey);
      }
    }
  });
});
