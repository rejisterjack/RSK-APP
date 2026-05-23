// Shared model selection state — accessible from any component without context hierarchy

type Listener = (model: string) => void;

let currentModel = 'auto';
const listeners = new Set<Listener>();

export function getSelectedModel(): string {
  return currentModel;
}

export function setSelectedModel(model: string): void {
  currentModel = model;
  for (const listener of listeners) {
    listener(model);
  }
}

export function subscribeToModel(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
