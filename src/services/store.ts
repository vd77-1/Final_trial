import { useSyncExternalStore } from "react";
import type { AppUser, CollectionMap, CollectionName } from "@/data/types";
import { getBackend } from "./backend";

/** Tiny observable collection. Backends (demo / Firebase) push documents into it. */
export class Store<T> {
  data: T[] = [];
  loaded = false;
  error: string | null = null;
  private listeners = new Set<() => void>();
  private snap: { data: T[]; loaded: boolean; error: string | null } = {
    data: [],
    loaded: false,
    error: null,
  };

  set(data: T[]) {
    this.data = data;
    this.loaded = true;
    this.error = null;
    this.publish();
  }
  fail(message: string) {
    this.error = message;
    this.loaded = true;
    this.publish();
  }
  reset() {
    this.data = [];
    this.loaded = false;
    this.error = null;
    this.publish();
  }
  private publish() {
    this.snap = { data: this.data, loaded: this.loaded, error: this.error };
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getSnapshot = () => {
    ensureStarted();
    return this.snap;
  };
}

export const stores: { [K in CollectionName]: Store<CollectionMap[K]> } = {
  booths: new Store(),
  complaints: new Store(),
  tasks: new Store(),
  history: new Store(),
  users: new Store(),
};

/** Auth state: undefined = still resolving, null = signed out. */
class AuthStore {
  user: AppUser | null | undefined = undefined;
  private listeners = new Set<() => void>();
  set(u: AppUser | null) {
    this.user = u;
    this.listeners.forEach((l) => l());
  }
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };
  getSnapshot = () => {
    ensureStarted();
    return this.user;
  };
}
export const authStore = new AuthStore();

let started = false;
export function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  getBackend().start();
}

const SERVER_SNAP = { data: [] as never[], loaded: false, error: null };
export function useCollectionState<K extends CollectionName>(name: K) {
  const store = stores[name] as Store<CollectionMap[K]>;
  return useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    () => SERVER_SNAP as { data: CollectionMap[K][]; loaded: boolean; error: string | null },
  );
}

export const useBooths = () => useCollectionState("booths").data;
export const useComplaints = () => useCollectionState("complaints").data;
export const useTasks = () => useCollectionState("tasks").data;
export const useHistory = () => useCollectionState("history").data;
export const useUsers = () => useCollectionState("users").data;

export function useBooth(id: string | undefined) {
  const { data, loaded } = useCollectionState("booths");
  const key = id?.trim().toUpperCase().replace(/[\s_]/g, "-");
  const norm = (s: string) => {
    const m = s.trim().match(/^([a-z]+)[\s_-]*0*(\d+)$/i);
    return m ? `${m[1]!.toUpperCase()}${m[2]}` : s.trim().toUpperCase();
  };
  const booth = key ? data.find((b) => norm(b.id) === norm(key)) : undefined;
  return { booth, loaded };
}

export function useAuthUser() {
  return useSyncExternalStore(authStore.subscribe, authStore.getSnapshot, () => undefined);
}

const noop = () => () => {};
/** false during SSR / first render, true in the browser. */
export function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
