import { IRepository } from '../types';

export abstract class LocalStorageRepository<T extends { id: string }> implements IRepository<T, string> {
  protected memoryItems: T[] = [];

  constructor(protected storageKey: string) {}

  protected getRawItems(): T[] {
    if (typeof window === 'undefined') return [...this.memoryItems];
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        return JSON.parse(raw);
      }
      return [...this.memoryItems];
    } catch (err) {
      console.error(`Failed to load items for key '${this.storageKey}':`, err);
      return [...this.memoryItems];
    }
  }

  protected saveRawItems(items: T[]): void {
    this.memoryItems = [...items];
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(items));
    } catch (err) {
      console.error(`Failed to save items for key '${this.storageKey}':`, err);
    }
  }

  public async findById(id: string): Promise<T | null> {
    const items = this.getRawItems();
    return items.find((item) => item.id === id) || null;
  }

  public async findAll(): Promise<T[]> {
    return this.getRawItems();
  }

  public async save(entity: T): Promise<T> {
    const items = this.getRawItems();
    const index = items.findIndex((item) => item.id === entity.id);
    if (index >= 0) {
      items[index] = entity;
    } else {
      items.push(entity);
    }
    this.saveRawItems(items);
    return entity;
  }

  public async saveAll(entities: T[]): Promise<T[]> {
    this.saveRawItems(entities);
    return entities;
  }

  public async delete(id: string): Promise<boolean> {
    const items = this.getRawItems();
    const filtered = items.filter((item) => item.id !== id);
    if (filtered.length === items.length) return false;
    this.saveRawItems(filtered);
    return true;
  }
}
