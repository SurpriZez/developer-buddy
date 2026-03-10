import type {
  StorageSchema,
  Script,
  EnvProfile,
  ApiRequest,
  ApiCollection,
  DocSource,
  UserScript,
} from '../types';

const STORAGE_KEY = 'developer_buddy_data';

const DEFAULTS: StorageSchema = {
  scripts: [],
  envProfiles: [],
  apiRequests: [],
  apiCollections: [],
  docSources: [],
  userScripts: [],
};

export class StorageService {
  private static async readAll(): Promise<StorageSchema> {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    if (!result[STORAGE_KEY]) {
      return {
        scripts: [],
        envProfiles: [],
        apiRequests: [],
        apiCollections: [],
        docSources: [],
        userScripts: [],
      };
    }
    return { ...DEFAULTS, ...result[STORAGE_KEY] };
  }

  private static async writeAll(data: StorageSchema): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  }

  // --- Scripts ---

  static async getScripts(): Promise<Script[]> {
    const data = await StorageService.readAll();
    return data.scripts;
  }

  static async saveScript(script: Script): Promise<void> {
    const data = await StorageService.readAll();
    const idx = data.scripts.findIndex((s) => s.id === script.id);
    if (idx >= 0) {
      data.scripts[idx] = script;
    } else {
      data.scripts.push(script);
    }
    await StorageService.writeAll(data);
  }

  static async deleteScript(id: string): Promise<void> {
    const data = await StorageService.readAll();
    data.scripts = data.scripts.filter((s) => s.id !== id);
    await StorageService.writeAll(data);
  }

  // --- Env Profiles ---

  static async getEnvProfiles(): Promise<EnvProfile[]> {
    const data = await StorageService.readAll();
    return data.envProfiles;
  }

  static async saveEnvProfile(profile: EnvProfile): Promise<void> {
    const data = await StorageService.readAll();
    const idx = data.envProfiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      data.envProfiles[idx] = profile;
    } else {
      data.envProfiles.push(profile);
    }
    await StorageService.writeAll(data);
  }

  static async deleteEnvProfile(id: string): Promise<void> {
    const data = await StorageService.readAll();
    data.envProfiles = data.envProfiles.filter((p) => p.id !== id);
    await StorageService.writeAll(data);
  }

  static async setActiveProfile(id: string): Promise<void> {
    const data = await StorageService.readAll();
    data.envProfiles = data.envProfiles.map((p) => ({
      ...p,
      isActive: p.id === id,
    }));
    await StorageService.writeAll(data);
  }

  static async getActiveProfile(): Promise<EnvProfile | null> {
    const data = await StorageService.readAll();
    return data.envProfiles.find((p) => p.isActive) ?? null;
  }

  // --- API Requests ---

  static async getApiRequests(): Promise<ApiRequest[]> {
    const data = await StorageService.readAll();
    return data.apiRequests;
  }

  static async saveApiRequest(request: ApiRequest): Promise<void> {
    const data = await StorageService.readAll();
    const idx = data.apiRequests.findIndex((r) => r.id === request.id);
    if (idx >= 0) {
      data.apiRequests[idx] = request;
    } else {
      data.apiRequests.push(request);
    }
    await StorageService.writeAll(data);
  }

  static async deleteApiRequest(id: string): Promise<void> {
    const data = await StorageService.readAll();
    data.apiRequests = data.apiRequests.filter((r) => r.id !== id);
    await StorageService.writeAll(data);
  }

  // --- API Collections ---

  static async getApiCollections(): Promise<ApiCollection[]> {
    const data = await StorageService.readAll();
    return data.apiCollections;
  }

  static async saveApiCollection(collection: ApiCollection): Promise<void> {
    const data = await StorageService.readAll();
    const idx = data.apiCollections.findIndex((c) => c.id === collection.id);
    if (idx >= 0) {
      data.apiCollections[idx] = collection;
    } else {
      data.apiCollections.push(collection);
    }
    await StorageService.writeAll(data);
  }

  static async deleteApiCollection(id: string): Promise<void> {
    const data = await StorageService.readAll();
    data.apiCollections = data.apiCollections.filter((c) => c.id !== id);
    await StorageService.writeAll(data);
  }

  // --- Doc Sources ---

  static async getDocSources(): Promise<DocSource[]> {
    const data = await StorageService.readAll();
    return data.docSources;
  }

  static async saveDocSource(source: DocSource): Promise<void> {
    const data = await StorageService.readAll();
    const idx = data.docSources.findIndex((d) => d.id === source.id);
    if (idx >= 0) {
      data.docSources[idx] = source;
    } else {
      data.docSources.push(source);
    }
    await StorageService.writeAll(data);
  }

  static async deleteDocSource(id: string): Promise<void> {
    const data = await StorageService.readAll();
    data.docSources = data.docSources.filter((d) => d.id !== id);
    await StorageService.writeAll(data);
  }

  // --- User Scripts ---

  static async getUserScripts(): Promise<UserScript[]> {
    const data = await StorageService.readAll();
    return data.userScripts;
  }

  static async saveUserScript(script: UserScript): Promise<void> {
    const data = await StorageService.readAll();
    const idx = data.userScripts.findIndex((s) => s.id === script.id);
    if (idx >= 0) {
      data.userScripts[idx] = script;
    } else {
      data.userScripts.push(script);
    }
    await StorageService.writeAll(data);
  }

  static async deleteUserScript(id: string): Promise<void> {
    const data = await StorageService.readAll();
    data.userScripts = data.userScripts.filter((s) => s.id !== id);
    await StorageService.writeAll(data);
  }

  // --- Full export / import ---

  static async exportAll(): Promise<StorageSchema> {
    return StorageService.readAll();
  }

  static async importAll(data: StorageSchema): Promise<void> {
    await StorageService.writeAll(data);
  }
}
