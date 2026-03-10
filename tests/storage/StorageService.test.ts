import { StorageService } from '../../src/shared/storage/StorageService';
import type { Script, EnvProfile, StorageSchema } from '../../src/shared/types';

function makeScript(overrides: Partial<Script> = {}): Script {
  return {
    id: 'script-1',
    name: 'Test Script',
    description: '',
    tags: [],
    language: 'javascript',
    body: 'console.log("hi")',
    isPinned: false,
    createdAt: new Date().toISOString(),
    lastRunAt: null,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<EnvProfile> = {}): EnvProfile {
  return {
    id: 'profile-1',
    name: 'staging',
    isActive: false,
    variables: [],
    ...overrides,
  };
}

describe('StorageService — Scripts', () => {
  it('getScripts() returns [] on empty storage', async () => {
    const scripts = await StorageService.getScripts();
    expect(scripts).toEqual([]);
  });

  it('saveScript() persists and getScripts() retrieves it', async () => {
    const script = makeScript();
    await StorageService.saveScript(script);
    const scripts = await StorageService.getScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).toEqual(script);
  });

  it('saveScript() updates an existing script by id', async () => {
    const script = makeScript();
    await StorageService.saveScript(script);
    const updated = { ...script, name: 'Updated Name' };
    await StorageService.saveScript(updated);
    const scripts = await StorageService.getScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].name).toBe('Updated Name');
  });

  it('deleteScript() removes by id', async () => {
    await StorageService.saveScript(makeScript({ id: 'a' }));
    await StorageService.saveScript(makeScript({ id: 'b' }));
    await StorageService.deleteScript('a');
    const scripts = await StorageService.getScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].id).toBe('b');
  });
});

describe('StorageService — Env Profiles', () => {
  it('getActiveProfile() returns null when no profiles exist', async () => {
    const profile = await StorageService.getActiveProfile();
    expect(profile).toBeNull();
  });

  it('setActiveProfile() marks the target active and all others inactive', async () => {
    await StorageService.saveEnvProfile(makeProfile({ id: 'p1', isActive: true }));
    await StorageService.saveEnvProfile(makeProfile({ id: 'p2', isActive: false }));
    await StorageService.setActiveProfile('p2');
    const profiles = await StorageService.getEnvProfiles();
    expect(profiles.find((p) => p.id === 'p1')?.isActive).toBe(false);
    expect(profiles.find((p) => p.id === 'p2')?.isActive).toBe(true);
  });

  it('getActiveProfile() returns the active profile', async () => {
    await StorageService.saveEnvProfile(makeProfile({ id: 'p1', isActive: false }));
    await StorageService.saveEnvProfile(makeProfile({ id: 'p2', name: 'prod', isActive: true }));
    const active = await StorageService.getActiveProfile();
    expect(active?.id).toBe('p2');
    expect(active?.name).toBe('prod');
  });

  it('deleteEnvProfile() removes by id', async () => {
    await StorageService.saveEnvProfile(makeProfile({ id: 'p1' }));
    await StorageService.saveEnvProfile(makeProfile({ id: 'p2' }));
    await StorageService.deleteEnvProfile('p1');
    const profiles = await StorageService.getEnvProfiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe('p2');
  });
});

describe('StorageService — exportAll / importAll', () => {
  it('exportAll() returns the complete schema shape with all keys', async () => {
    const data = await StorageService.exportAll();
    const keys: (keyof StorageSchema)[] = [
      'scripts', 'envProfiles', 'apiRequests', 'apiCollections', 'docSources', 'userScripts',
    ];
    for (const key of keys) {
      expect(data).toHaveProperty(key);
      expect(Array.isArray(data[key])).toBe(true);
    }
  });

  it('importAll() overwrites all collections', async () => {
    await StorageService.saveScript(makeScript({ id: 'old' }));
    const incoming: StorageSchema = {
      scripts: [makeScript({ id: 'new', name: 'Imported' })],
      envProfiles: [],
      apiRequests: [],
      apiCollections: [],
      docSources: [],
      userScripts: [],
    };
    await StorageService.importAll(incoming);
    const scripts = await StorageService.getScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].id).toBe('new');
  });
});
