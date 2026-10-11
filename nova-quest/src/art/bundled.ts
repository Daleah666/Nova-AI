import bram from '../assets/art/bram.webp'
import cleric from '../assets/art/cleric.webp'
import fighter from '../assets/art/fighter.webp'
import goblin from '../assets/art/goblin.webp'
import grik from '../assets/art/grik.webp'
import mira from '../assets/art/mira.webp'
import myconid from '../assets/art/myconid.webp'
import rogue from '../assets/art/rogue.webp'
import skeleton from '../assets/art/skeleton.webp'
import slime from '../assets/art/slime.webp'
import tess from '../assets/art/tess.webp'
import wendel from '../assets/art/wendel.webp'
import wizard from '../assets/art/wizard.webp'
import wolf from '../assets/art/wolf.webp'
import wyrmling from '../assets/art/wyrmling.webp'

/** Default illustrated sprites (transparent WebP), keyed like custom art. */
export const BUNDLED_ART: Record<string, string> = {
  'class:fighter': fighter,
  'class:wizard': wizard,
  'class:rogue': rogue,
  'class:cleric': cleric,
  'npc:mira': mira,
  'npc:bram': bram,
  'npc:tess': tess,
  'npc:wendel': wendel,
  'npc:guard': goblin,
  'npc:grik': grik,
  'npc:wyrmling': wyrmling,
  'monster:goblin': goblin,
  'monster:slime': slime,
  'monster:wolf': wolf,
  'monster:skeleton': skeleton,
  'monster:myconid': myconid,
  'monster:wyrmling': wyrmling,
}
