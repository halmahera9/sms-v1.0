import 'server-only';
import { IObjectStorageProvider } from './types';
import { InMemoryObjectStorageProvider } from './in-memory';

let globalStorageProvider: IObjectStorageProvider = new InMemoryObjectStorageProvider();

/**
 * Returns the active platform IObjectStorageProvider instance.
 */
export function getObjectStorageProvider(): IObjectStorageProvider {
  return globalStorageProvider;
}

/**
 * Overrides active storage provider (useful for testing or future provider switching).
 */
export function setObjectStorageProvider(provider: IObjectStorageProvider): void {
  globalStorageProvider = provider;
}

/**
 * Resets storage provider to a fresh InMemoryObjectStorageProvider instance.
 */
export function resetObjectStorageProvider(): void {
  globalStorageProvider = new InMemoryObjectStorageProvider();
}
