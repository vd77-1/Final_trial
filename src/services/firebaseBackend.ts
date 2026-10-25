import type {
  AppUser,
  CollectionMap,
  CollectionName,
  Complaint,
  SensorReading,
} from "@/data/types";
import type { Backend } from "./backend";
import { authStore, stores } from "./store";

const env = import.meta.env as Record<string, string | undefined>;

/** Firebase is used only when these variables are present (see .env.example). */
export const firebaseConfigured = () =>
  Boolean(env["VITE_FIREBASE_API_KEY"] && env["VITE_FIREBASE_PROJECT_ID"]);

/** Logical collection name -> Firestore collection name. */
const COL: Record<CollectionName, string> = {
  booths: "water_booths",
  complaints: "complaints",
  tasks: "maintenance_tasks",
  history: "maintenance_history",
  users: "users",
};
const READINGS = "sensor_readings";

type FsMod = typeof import("firebase/firestore");
type Ctx = {
  fs: FsMod;
  db: import("firebase/firestore").Firestore;
  authMod: typeof import("firebase/auth");
  auth: import("firebase/auth").Auth;
  stMod: typeof import("firebase/storage");
  storage: import("firebase/storage").FirebaseStorage;
};

const asMessage = (e: unknown) => (e instanceof Error ? e.message : "Network or permission error.");

/**
 * Firebase adapter (Firestore + Auth + Storage). Same interface as the demo backend.
 * The SDK is loaded lazily so demo mode ships without it.
 * NOTE: written against the modular v9+ API; it needs a real Firebase project to run.
 */
export function createFirebaseBackend(): Backend {
  let ctxPromise: Promise<Ctx> | null = null;
  const ctx = () =>
    (ctxPromise ??= (async () => {
      const [{ initializeApp }, fs, authMod, stMod] = await Promise.all([
        import("firebase/app"),
        import("firebase/firestore"),
        import("firebase/auth"),
        import("firebase/storage"),
      ]);
      const app = initializeApp({
        apiKey: env["VITE_FIREBASE_API_KEY"]!,
        authDomain: env["VITE_FIREBASE_AUTH_DOMAIN"]!,
        projectId: env["VITE_FIREBASE_PROJECT_ID"]!,
        storageBucket: env["VITE_FIREBASE_STORAGE_BUCKET"]!,
        messagingSenderId: env["VITE_FIREBASE_MESSAGING_SENDER_ID"]!,
        appId: env["VITE_FIREBASE_APP_ID"]!,
      });
      const db = fs.initializeFirestore(app, { ignoreUndefinedProperties: true });
      return { fs, db, authMod, auth: authMod.getAuth(app), stMod, storage: stMod.getStorage(app) };
    })());

  let staffUnsubs: Array<() => void> = [];
  const detachStaff = () => {
    staffUnsubs.forEach((u) => u());
    staffUnsubs = [];
    stores.complaints.reset();
    stores.tasks.reset();
    stores.history.reset();
    stores.users.reset();
  };

  async function loadProfile(c: Ctx, uid: string): Promise<AppUser | null> {
    const snap = await c.fs.getDoc(c.fs.doc(c.db, COL.users, uid));
    if (!snap.exists()) return null;
    const d = snap.data() as Omit<AppUser, "id">;
    if (d.role !== "admin" && d.role !== "mts") return null;
    return { ...d, id: uid };
  }

  function listen<K extends CollectionName>(
    c: Ctx,
    name: K,
    q?: import("firebase/firestore").Query,
  ) {
    const target = q ?? c.fs.collection(c.db, COL[name]);
    return c.fs.onSnapshot(
      target,
      (snap) => {
        const docs = snap.docs.map(
          (d) => ({ ...d.data(), id: d.id }) as unknown as CollectionMap[K],
        );
        (stores[name] as unknown as { set(d: unknown[]): void }).set(docs);
      },
      (err) => (stores[name] as unknown as { fail(m: string): void }).fail(asMessage(err)),
    );
  }

  function attachStaff(c: Ctx, user: AppUser) {
    detachStaff();
    const { fs, db } = c;
    staffUnsubs.push(listen(c, "complaints"));
    staffUnsubs.push(listen(c, "history"));
    staffUnsubs.push(listen(c, "users"));
    // Admins see every task; MTS only their own (Firestore rules enforce the same).
    staffUnsubs.push(
      listen(
        c,
        "tasks",
        user.role === "admin"
          ? fs.collection(db, COL.tasks)
          : fs.query(fs.collection(db, COL.tasks), fs.where("assignedTo", "==", user.id)),
      ),
    );
  }

  return {
    mode: "firebase",
    start() {
      ctx()
        .then((c) => {
          listen(c, "booths");
          c.authMod.onAuthStateChanged(c.auth, async (fbUser) => {
            if (!fbUser) {
              detachStaff();
              authStore.set(null);
              return;
            }
            try {
              const profile = await loadProfile(c, fbUser.uid);
              if (!profile) {
                await c.authMod.signOut(c.auth);
                authStore.set(null);
                return;
              }
              authStore.set(profile);
              attachStaff(c, profile);
            } catch {
              authStore.set(null);
            }
          });
        })
        .catch((e) => stores.booths.fail(asMessage(e)));
    },
    async put(name, docData) {
      const c = await ctx();
      await c.fs.setDoc(c.fs.doc(c.db, COL[name], docData.id), docData);
    },
    async remove(name, id) {
      const c = await ctx();
      await c.fs.deleteDoc(c.fs.doc(c.db, COL[name], id));
    },
    async getComplaint(id) {
      const c = await ctx();
      const snap = await c.fs.getDoc(c.fs.doc(c.db, COL.complaints, id.trim().toUpperCase()));
      return snap.exists() ? ({ ...snap.data(), id: snap.id } as Complaint) : null;
    },
    async getReadings(ids, since) {
      const c = await ctx();
      const { fs, db } = c;
      const entries = await Promise.all(
        ids.map(async (id) => {
          const snap = await fs.getDocs(
            fs.query(
              fs.collection(db, READINGS),
              fs.where("boothId", "==", id),
              fs.where("ts", ">=", new Date(since).toISOString()),
              fs.orderBy("ts", "asc"),
            ),
          );
          return [id, snap.docs.map((d) => d.data() as SensorReading)] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
    async getLatest(ids) {
      const c = await ctx();
      const { fs, db } = c;
      const entries = await Promise.all(
        ids.map(async (id) => {
          const snap = await fs.getDocs(
            fs.query(
              fs.collection(db, READINGS),
              fs.where("boothId", "==", id),
              fs.orderBy("ts", "desc"),
              fs.limit(1),
            ),
          );
          return [id, snap.docs[0]?.data() as SensorReading | undefined] as const;
        }),
      );
      return Object.fromEntries(entries);
    },
    async uploadPhoto(complaintId, file) {
      const c = await ctx();
      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      const r = c.stMod.ref(c.storage, `complaint_photos/${complaintId}/${Date.now()}-${safe}`);
      await c.stMod.uploadBytes(r, file, { contentType: file.type });
      return c.stMod.getDownloadURL(r);
    },
    async signIn(email, password) {
      const c = await ctx();
      const cred = await c.authMod.signInWithEmailAndPassword(c.auth, email.trim(), password);
      const profile = await loadProfile(c, cred.user.uid);
      if (!profile) {
        await c.authMod.signOut(c.auth);
        throw new Error("This account has no TRISHNA role. Ask an administrator to add it.");
      }
      return profile;
    },
    async signOut() {
      const c = await ctx();
      await c.authMod.signOut(c.auth);
    },
  };
}
