// DEV-ONLY network simulator, used to exercise offline behaviour without touching the browser's devtools.
// The Figma "Network ON/OFF" switch is a design/demo control, so it must never reach production:
// every entry point is gated on `import.meta.env.DEV`, which Vite replaces with `false` in production builds.

export const DEV_NETWORK_TOGGLE_ENABLED: boolean = import.meta.env.DEV;

let simulatedOffline = false;
let installed = false;
const listeners = new Set<() => void>();

function installOnLineOverride() {
  if (installed || typeof navigator === 'undefined') return;
  installed = true;
  const realOnLine = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')?.get;
  // Shadow navigator.onLine so every consumer (ConnectionPill, sync code) sees the simulated state, even on remount.
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    get: () => (simulatedOffline ? false : (realOnLine?.call(navigator) ?? true)),
  });
}

export function isSimulatedOffline(): boolean {
  return simulatedOffline;
}

export function setSimulatedOffline(offline: boolean): void {
  if (!DEV_NETWORK_TOGGLE_ENABLED || offline === simulatedOffline) return;
  installOnLineOverride();
  simulatedOffline = offline;
  window.dispatchEvent(new Event(offline ? 'offline' : 'online'));
  listeners.forEach((listener) => listener());
}

export function subscribeSimulatedNetwork(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
