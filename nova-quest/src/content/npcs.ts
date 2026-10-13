export interface NpcDef {
  id: string
  name: string
  title: string
  sprite: string
}

export const NPCS: Record<string, NpcDef> = {
  mira: { id: 'mira', name: 'Mira', title: 'The Hooded Figure (Senior Ledger-Keeper)', sprite: 'mira' },
  bram: { id: 'bram', name: 'Old Bram', title: 'Barkeep of the Sleepy Wyvern', sprite: 'bram' },
  tess: { id: 'tess', name: 'Tess', title: 'Cobbler & Shopkeeper', sprite: 'tess' },
  wendel: { id: 'wendel', name: 'Farmer Wendel', title: 'Possibly Infested', sprite: 'wendel' },
  guard: { id: 'guard', name: 'Goblin Guard', title: 'Door Security', sprite: 'goblin' },
  grik: { id: 'grik', name: 'Boss Grik', title: 'Goblin Chieftain (Interim)', sprite: 'grik' },
  wyrmling: { id: 'wyrmling', name: 'Red Wyrmling', title: 'Napping on the Ledger', sprite: 'wyrmling' },
}
