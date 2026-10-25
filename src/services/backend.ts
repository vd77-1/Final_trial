import type {
  AppUser,
  CollectionMap,
  CollectionName,
  Complaint,
  SensorReading,
} from "@/data/types";
import { createDemoBackend } from "./demoBackend";
import { createFirebaseBackend, firebaseConfigured } from "./firebaseBackend";

/**
 * Persistence boundary. The UI only talks to this interface (via actions.ts and the
 * hooks in store.ts), so switching between the localStorage demo and Firebase needs
 * no UI changes. Firebase is used automatically when VITE_FIREBASE_* variables exist.
 */
export interface Backend {
  mode: "demo" | "firebase";
  /** Begin syncing collections into the stores. Called once, client side. */
  start(): void;
  put<K extends CollectionName>(name: K, doc: CollectionMap[K]): Promise<void>;
  remove(name: CollectionName, id: string): Promise<void>;
  /** Public lookup of a single complaint by its reference number. */
  getComplaint(id: string): Promise<Complaint | null>;
  /** Readings per booth since `sinceMs`, ascending by time. */
  getReadings(boothIds: string[], sinceMs: number): Promise<Record<string, SensorReading[]>>;
  getLatest(boothIds: string[]): Promise<Record<string, SensorReading | undefined>>;
  uploadPhoto(complaintId: string, file: File): Promise<string>;
  signIn(email: string, password: string): Promise<AppUser>;
  signOut(): Promise<void>;
  /** Demo only. */
  resetDemo?(): void;
}

let backend: Backend | null = null;
export function getBackend(): Backend {
  if (!backend) backend = firebaseConfigured() ? createFirebaseBackend() : createDemoBackend();
  return backend;
}

export const isDemoMode = () => !firebaseConfigured();
