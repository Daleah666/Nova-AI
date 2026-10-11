import type { ItemDef } from '../engine/types'

export const ITEMS: Record<string, ItemDef> = {
  potion: {
    id: 'potion',
    name: 'Potion',
    description: 'Restores 2d4+2 HP.',
    price: 10,
    target: 'ally',
    effect: 'heal',
    dice: '2d4+2',
  },
  'hi-potion': {
    id: 'hi-potion',
    name: 'Hi-Potion',
    description: 'Restores 4d4+4 HP.',
    price: 30,
    target: 'ally',
    effect: 'heal',
    dice: '4d4+4',
  },
  ether: {
    id: 'ether',
    name: 'Ether',
    description: 'Restores 2d4 MP.',
    price: 20,
    target: 'ally',
    effect: 'mp',
    dice: '2d4',
  },
  'phoenix-feather': {
    id: 'phoenix-feather',
    name: 'Phoenix Feather',
    description: 'Revives a fallen ally with a quarter of their HP.',
    price: 50,
    target: 'ally-down',
    effect: 'revive',
    dice: '0',
  },
  'fire-flask': {
    id: 'fire-flask',
    name: 'Fire Flask',
    description: 'Throw for 2d6 fire damage.',
    price: 15,
    target: 'enemy',
    effect: 'damage',
    dice: '2d6',
  },
}
