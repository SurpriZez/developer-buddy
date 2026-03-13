// --- Scripts ---
export type ScriptLanguage = 'javascript' | 'shell';

export interface Script {
  id: string;
  name: string;
  description: string;
  tags: string[];
  language: ScriptLanguage;
  body: string;
  isPinned: boolean;
  createdAt: string;   // ISO8601
  lastRunAt: string | null;
}

// --- Environment Profiles ---
export interface EnvVariable {
  key: string;
  value: string;
  secret: boolean;
}

export interface EnvProfile {
  id: string;
  name: string;
  isActive: boolean;
  variables: EnvVariable[];
}

// --- API Tester ---
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS';

export interface ApiRequestHeader {
  key: string;
  value: string;
  enabled: boolean;
}

export interface ApiRequestParam {
  key: string;
  value: string;
  enabled: boolean;
}

export type ApiRequestBodyType = 'none' | 'json' | 'form-data' | 'raw';

export interface ApiRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: ApiRequestHeader[];
  params: ApiRequestParam[];
  bodyType: ApiRequestBodyType;
  body: string;
  collectionId: string | null;
  createdAt: string;
}

export interface ApiCollection {
  id: string;
  name: string;
  requestIds: string[];
}

export interface ApiResponse {
  requestId: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  durationMs: number;
  timestamp: string;
}

// --- Documentation Sources ---
export interface DocSource {
  id: string;
  name: string;
  url: string;
  isPinned: boolean;
}

// --- User Scripts ---
export type UserScriptRunAt = 'document-start' | 'document-end' | 'document-idle';

export type UserScriptGrant =
  | 'DB_setValue'
  | 'DB_getValue'
  | 'DB_deleteValue'
  | 'DB_xmlhttpRequest'
  | 'DB_openInTab'
  | 'DB_setClipboard'
  | 'DB_notification'
  | 'DB_getActiveEnv';

export interface UserScript {
  id: string;
  name: string;
  description: string;
  version: string;
  matchPatterns: string[];
  runAt: UserScriptRunAt;
  enabled: boolean;
  body: string;
  grants: UserScriptGrant[];
  installedAt: string;
  updatedAt: string;
}

// --- Self-Service Actions ---

export interface ActionVariable {
  key: string;
  value: string;
  secret: boolean;
}

export interface SelfServiceAction {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;               // supports {{VAR_NAME}} interpolation
  headers: { key: string; value: string; enabled: boolean }[];
  body: string;              // empty string = no body; used for POST/PUT/PATCH only
  confirmationPrompt: string; // empty string = no confirmation required
  createdAt: string;         // ISO8601
  updatedAt: string;         // ISO8601
}

// --- Root Storage Schema ---
export interface StorageSchema {
  scripts: Script[];
  envProfiles: EnvProfile[];
  apiRequests: ApiRequest[];
  apiCollections: ApiCollection[];
  docSources: DocSource[];
  userScripts: UserScript[];
  selfServiceActions: SelfServiceAction[];
  actionVariables: ActionVariable[];
}
