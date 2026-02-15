export const DEBUGGER_ENABLED_STORAGE_KEY = 'retirement:debugger-enabled';

export function getDebuggerEnabledFromStorage(storage: Storage): boolean {
  return storage.getItem(DEBUGGER_ENABLED_STORAGE_KEY) === 'true';
}

export function setDebuggerEnabledInStorage(storage: Storage, enabled: boolean): void {
  storage.setItem(DEBUGGER_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
}
