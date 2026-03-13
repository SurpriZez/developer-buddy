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
      'selfServiceActions', 'actionVariables',
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
      selfServiceActions: [],
      actionVariables: [],
    };
    await StorageService.importAll(incoming);
    const scripts = await StorageService.getScripts();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].id).toBe('new');
  });
});

function makeAction(overrides: Partial<import('../../src/shared/types').SelfServiceAction> = {}): import('../../src/shared/types').SelfServiceAction {
  return {
    id: 'action-1',
    name: 'Deploy Staging',
    method: 'POST',
    url: 'https://hooks.example.com/deploy',
    headers: [],
    body: '',
    confirmationPrompt: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('StorageService — SelfServiceActions', () => {
  it('getSelfServiceActions() returns [] on empty storage', async () => {
    const actions = await StorageService.getSelfServiceActions();
    expect(actions).toEqual([]);
  });

  it('saveSelfServiceAction() persists and retrieves an action', async () => {
    const action = makeAction();
    await StorageService.saveSelfServiceAction(action);
    const actions = await StorageService.getSelfServiceActions();
    expect(actions).toHaveLength(1);
    expect(actions[0]).toEqual(action);
  });

  it('saveSelfServiceAction() updates an existing action by id', async () => {
    const action = makeAction();
    await StorageService.saveSelfServiceAction(action);
    await StorageService.saveSelfServiceAction({ ...action, name: 'Updated' });
    const actions = await StorageService.getSelfServiceActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].name).toBe('Updated');
  });

  it('deleteSelfServiceAction() removes by id', async () => {
    await StorageService.saveSelfServiceAction(makeAction({ id: 'a' }));
    await StorageService.saveSelfServiceAction(makeAction({ id: 'b' }));
    await StorageService.deleteSelfServiceAction('a');
    const actions = await StorageService.getSelfServiceActions();
    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('b');
  });
});

describe('StorageService — ActionVariables', () => {
  it('getActionVariables() returns [] on empty storage', async () => {
    const vars = await StorageService.getActionVariables();
    expect(vars).toEqual([]);
  });

  it('saveActionVariables() replaces the full list', async () => {
    const vars = [
      { key: 'API_TOKEN', value: 'tok-1', secret: true },
      { key: 'BASE_URL', value: 'https://example.com', secret: false },
    ];
    await StorageService.saveActionVariables(vars);
    const result = await StorageService.getActionVariables();
    expect(result).toEqual(vars);
  });

  it('saveActionVariables([]) clears all variables', async () => {
    await StorageService.saveActionVariables([{ key: 'K', value: 'V', secret: false }]);
    await StorageService.saveActionVariables([]);
    const result = await StorageService.getActionVariables();
    expect(result).toEqual([]);
  });
});
