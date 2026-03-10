// Chrome storage mock. All functions read/write via (globalThis as any).__store
// so there is no closure aliasing issue across module evaluations.

/* eslint-disable @typescript-eslint/no-explicit-any */

(globalThis as any).__store = {};

const g = globalThis as any;

(globalThis as any).chrome = {
  storage: {
    local: {
      get:    async (key: string)                    => ({ [key]: g.__store[key] }),
      set:    async (items: Record<string, unknown>) => { Object.assign(g.__store, items); },
      remove: async (key: string)                    => { delete g.__store[key]; },
      clear:  async ()                               => { Object.keys(g.__store).forEach((k: string) => delete g.__store[k]); },
    },
  },
};

beforeEach(() => {
  // Wipe the store between every test
  Object.keys(g.__store).forEach((k: string) => delete g.__store[k]);
});
