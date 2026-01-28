export const BASE_ITEMS = [
  // ARMAS (Dano e Crítico)
  { id: 'sword', name: 'Espada Longa', type: 'weapon', icon: '⚔️', baseStats: { attack: null, critChance: null } },
  { id: 'axe', name: 'Machado de Guerra', type: 'weapon', icon: '🪓', baseStats: { attack: null, critChance: null } },

  // ESCUDO (Defesa e Shield)
  { id: 'shield', name: 'Escudo de Carvalho', type: 'shield', icon: '🛡️', baseStats: { defense: null, shield: null } },

  // ARMADURA DE PEITO (Defesa e Shield)
  { id: 'chestplate', name: 'Peitoral de Aço', type: 'chest', icon: '👕', baseStats: { defense: null, shield: null } },

  // PARTES DA ARMADURA (Apenas Shield)
  { id: 'helmet', name: 'Elmo de Ferro', type: 'head', icon: '🪖', baseStats: { shield: null } },
  { id: 'gloves', name: 'Luvas de Couro', type: 'arms', icon: '🧤', baseStats: { shield: null } },
  { id: 'pants', name: 'Calças Reforçadas', type: 'pants', icon: '👖', baseStats: { shield: null } },
  { id: 'boots', name: 'Botas de Viajante', type: 'boots', icon: '👢', baseStats: { shield: null } },

  // ACESSÓRIOS (Atributos mistos/utilitários) podem receber qualquer atributo
  { id: 'ring', name: 'Anel do Poder', type: 'accessory', icon: '💍', baseStats: {} },
  { id: 'amulet', name: 'Amuleto Antigo', type: 'accessory', icon: '🧿', baseStats: {} },
];