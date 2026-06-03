import { type ReactNode } from 'react';
import type { PVService } from './PVService';
import { MockPVService } from './MockPVService';
import { PVServiceContext } from './pvServiceContext';

let serviceSingleton: PVService | null = null;
function getService(): PVService {
  if (!serviceSingleton) {
    const svc = new MockPVService();
    svc.connect();
    serviceSingleton = svc;
  }
  return serviceSingleton;
}

export function PVServiceProvider({ children }: { children: ReactNode }) {
  return <PVServiceContext.Provider value={getService()}>{children}</PVServiceContext.Provider>;
}
