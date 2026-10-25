import { seedBooths, seedComplaintsAndTasks, seedUsers, DEMO_PASSWORD } from "@/data/seed";
import { simulatedReadings } from "@/data/simulator";
import type { CollectionMap, CollectionName } from "@/data/types";
import type { Backend } from "./backend";
import { authStore, stores } from "./store";

const KEY = (n: string) => `trishna.demo.v2.${n}`;
const SESSION = "trishna.demo.session";

const read = <T>(name: string): T[] | null => {
  try {
    const raw = window.localStorage.getItem(KEY(name));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
};
const write = (name: string, docs: unknown[]) => {
  try {
    window.localStorage.setItem(KEY(name), JSON.stringify(docs));
  } catch {
    /* storage full or blocked: keep in-memory state only */
  }
};

function seedAll(): { [K in CollectionName]: CollectionMap[K][] } {
  const now = Date.now();
  const { complaints, tasks, history } = seedComplaintsAndTasks(now);
  return { booths: seedBooths(now), complaints, tasks, history, users: seedUsers() };
}

/** Compress a photo to a small JPEG data URL so it fits in localStorage. */
async function shrinkImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export function createDemoBackend(): Backend {
  const names = Object.keys(stores) as CollectionName[];

  function load() {
    const seeds = seedAll();
    for (const n of names) {
      const saved = read<CollectionMap[typeof n]>(n);
      const docs = saved ?? seeds[n];
      if (!saved) write(n, docs);
      (stores[n] as { set(d: unknown[]): void }).set(docs);
    }
  }

  function resolveSession() {
    try {
      const id = window.localStorage.getItem(SESSION);
      const user = id ? stores.users.data.find((u) => u.id === id) : undefined;
      authStore.set(user ?? null);
    } catch {
      authStore.set(null);
    }
  }

  const backend: Backend = {
    mode: "demo",
    start() {
      load();
      resolveSession();
      window.addEventListener("storage", (e) => {
        if (e.key?.startsWith("trishna.demo.")) {
          load();
          resolveSession();
        }
      });
    },
    async put(name, doc) {
      const store = stores[name] as unknown as { data: { id: string }[]; set(d: unknown[]): void };
      const exists = store.data.some((d) => d.id === doc.id);
      const next = exists
        ? store.data.map((d) => (d.id === doc.id ? doc : d))
        : [...store.data, doc];
      write(name, next);
      store.set(next);
    },
    async remove(name, id) {
      const store = stores[name] as unknown as { data: { id: string }[]; set(d: unknown[]): void };
      const next = store.data.filter((d) => d.id !== id);
      write(name, next);
      store.set(next);
    },
    async getComplaint(id) {
      return (
        stores.complaints.data.find((c) => c.id.toUpperCase() === id.trim().toUpperCase()) ?? null
      );
    },
    async getReadings(ids, since) {
      return Object.fromEntries(
        ids.map((id) => [id, simulatedReadings(id).filter((r) => Date.parse(r.ts) >= since)]),
      );
    },
    async getLatest(ids) {
      return Object.fromEntries(
        ids.map((id) => {
          const rs = simulatedReadings(id);
          return [id, rs[rs.length - 1]];
        }),
      );
    },
    async uploadPhoto(_id, file) {
      return shrinkImage(file);
    },
    async signIn(email, password) {
      const user = stores.users.data.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
      );
      if (!user || password !== DEMO_PASSWORD) throw new Error("Incorrect email or password.");
      try {
        window.localStorage.setItem(SESSION, user.id);
      } catch {
        /* ignore */
      }
      authStore.set(user);
      return user;
    },
    async signOut() {
      try {
        window.localStorage.removeItem(SESSION);
      } catch {
        /* ignore */
      }
      authStore.set(null);
    },
    resetDemo() {
      const seeds = seedAll();
      for (const n of names) {
        write(n, seeds[n]);
        (stores[n] as { set(d: unknown[]): void }).set(seeds[n]);
      }
    },
  };
  return backend;
}
