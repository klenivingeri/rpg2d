export const Debug = {
  // ao setar true mostra áreas de debug: colisão, tiro, visão
  showAreas: true
};

export function setShowAreas(v) {
  Debug.showAreas = !!v;
}

export function toggleShowAreas() {
  Debug.showAreas = !Debug.showAreas;
  return Debug.showAreas;
}
