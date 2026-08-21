import type { z } from 'zod';
import type { RpcProcedure } from './schema.js';

export interface RpcRegistry {
  register<T extends z.ZodTypeAny>(proc: RpcProcedure<T>): () => void;
  get(name: string): RpcProcedure | undefined;
  list(): string[];
  clear(): void;
}

export function createRpcRegistry(): RpcRegistry {
  const procedures = new Map<string, RpcProcedure>();

  function register<T extends z.ZodTypeAny>(proc: RpcProcedure<T>): () => void {
    if (procedures.has(proc.name)) throw new Error(`Duplicate RPC procedure: ${proc.name}`);
    procedures.set(proc.name, proc as unknown as RpcProcedure);
    return function unregister() {
      procedures.delete(proc.name);
    };
  }

  function get(name: string): RpcProcedure | undefined {
    return procedures.get(name);
  }

  function list(): string[] {
    return Array.from(procedures.keys());
  }

  function clear(): void {
    procedures.clear();
  }

  return { register, get, list, clear };
}
