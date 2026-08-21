// cspell: ignore sess
import { randomUUID } from 'node:crypto';

import { useContext } from '../app/context.js';
import type { Middleware } from '../base/common/types.js';
import { useCookies } from './cookies.js';
import { inject, type InjectionKey, provide } from './injection.js';

const SessionKey: InjectionKey<Session> = Symbol('session');

export interface Session {
  [name: string]: any;
}

export interface SessionOptions {
  name?: string;
  store?: SessionStorage;
}

export function session(options: SessionOptions = {}): Middleware {
  const { name = 'sess.sid', store = new MemorySessionStorage() } = options;

  return async (_, next) => {
    const { subscriptions } = useContext();

    const id = useSessionId(name);
    const data = await store.get(id);

    provide(SessionKey, data);

    subscriptions.push({
      dispose() {
        store.set(id, data);
      },
    });

    return next();
  };
}

export function useSession<T>(): Session & T {
  const session = inject(SessionKey);

  if (!session) {
    throw new Error('Session not found in context.\nMake sure to use the session middleware.');
  }

  return session as Session & T;
}

function useSessionId(name: string) {
  const cookies = useCookies();
  const sessionId = cookies.get(name);

  if (sessionId) {
    return sessionId;
  }

  const newSessionId = randomUUID();

  cookies.set(name, newSessionId);

  return newSessionId;
}

export interface SessionStorage {
  get(sessionId: string): Promise<Session>;
  set(sessionId: string, session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
}

class MemorySessionStorage implements SessionStorage {
  private store = new Map<string, Session>();

  getOrCreate(sessionId: string): Session | undefined;
  getOrCreate(sessionId: string, Create: true): Session;
  getOrCreate(sessionId: string, Create?: boolean): Session | undefined {
    const { store } = this;

    if (store.has(sessionId)) {
      return store.get(sessionId);
    }

    if (!Create) return;

    const session = {};

    store.set(sessionId, session);

    return session;
  }

  async get(sessionId: string) {
    return structuredClone(this.getOrCreate(sessionId, true));
  }

  async set(sessionId: string, session: Session) {
    this.store.set(sessionId, session);
  }

  async delete(sessionId: string) {
    this.store.delete(sessionId);
  }
}
