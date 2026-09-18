import 'server-only';
import { IObjectStorageProvider } from './types';
import { FileSystemObjectStorageProvider } from './filesystem';
import { InMemoryObjectStorageProvider } from './in-memory';

let globalStorageProvider: IObjectStorageProvider =
  process.env.NODE_ENV === 'test'
    ? new InMemoryObjectStorageProvider()
    : new FileSystemObjectStorageProvider();

export function getObjectStorageProvider(): IObjectStorageProvider {
  return globalStorageProvider;
}

export function setObjectStorageProvider(provider: IObjectStorageProvider): void {
  globalStorageProvider = provider;
}

export function resetObjectStorageProvider(): void {
  globalStorageProvider =
    process.env.NODE_ENV === 'test'
      ? new InMemoryObjectStorageProvider()
      : new FileSystemObjectStorageProvider();
}
