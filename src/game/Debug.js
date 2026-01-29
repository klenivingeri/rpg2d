import { EventBus } from './EventBus';

export const Debug = {
  // ao setar true mostra áreas de debug: colisão, tiro, visão
  showAreas: false
};

export function setShowAreas(v) {
  Debug.showAreas = !!v;
  try { EventBus.emit('debug-showAreas-changed', Debug.showAreas); } catch (e) { /* ignore */ }
}

export function toggleShowAreas() {
  Debug.showAreas = !Debug.showAreas;
  try { EventBus.emit('debug-showAreas-changed', Debug.showAreas); } catch (e) { /* ignore */ }
  return Debug.showAreas;
}
