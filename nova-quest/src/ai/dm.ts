import { formatRoll, roll, type RollMode } from '../engine/dice'
import { askOracle, LIKELIHOODS, type Likelihood } from '../engine/oracle'
import { pick } from '../engine/rng'

export interface DmConfig {
  baseUrl: string
  apiKey: string
  model: string
}

export interface DmToolEvent {
  name: string
  summary: string
}

export interface DmTurnResult {
  reply: string
  events: DmToolEvent[]
}

export interface DmContext {
  getPartyState: () => unknown
  log: (kind: 'roll' | 'oracle', text: string) => void
}

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

/*
 * As the article argues, the natural-language descriptions below matter more than the code:
 * they teach the model what each tool is for, when to reach for it, and why.
 */
export const DM_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'roll_dice',
      description:
        'Roll real dice using standard tabletop notation. ALWAYS use this instead of inventing numbers whenever the story calls for chance: attack rolls, damage, ability checks, saving throws, initiative, or random tables. Supports NdS, modifiers (1d20+5, 2d8-1), keep highest/lowest (4d6kh3, 2d20kl1), and percentile (d100). Advantage/disadvantage applies to a single d20. Returns every die, the total, and whether a d20 came up a natural 20 (critical success) or natural 1 (critical failure). For a critical hit, roll the damage again with critical=true, which doubles the dice but not the modifiers.',
      parameters: {
        type: 'object',
        properties: {
          notation: { type: 'string', description: 'Dice notation, e.g. "1d20+4" or "2d6+3".' },
          mode: {
            type: 'string',
            enum: ['normal', 'advantage', 'disadvantage'],
            description: 'Advantage rolls two d20s and keeps the higher; disadvantage keeps the lower.',
          },
          critical: { type: 'boolean', description: 'Critical-hit damage: double the dice, not the modifiers.' },
          reason: { type: 'string', description: 'What the roll is for, e.g. "Sven attacks the goblin".' },
        },
        required: ['notation', 'reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_oracle',
      description:
        "Ask the solo-play oracle a yes/no question about the world when you, the DM, are unsure what is true and want to stay honest and surprising, e.g. 'Is there a goblin hiding in the bushes?' or 'Is the merchant lying?'. Choose a likelihood that fits the fiction. Answers may be qualified ('Yes, but...', 'No, and...'): honor the qualifier. Sometimes a random twist is included; weave it in. Do not use the oracle for things the rules, the dice, or the player have already decided.",
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: 'A yes/no question about the game world.' },
          likelihood: {
            type: 'string',
            enum: LIKELIHOODS.map((l) => l.id),
            description: 'How likely a "yes" is given the fiction so far.',
          },
        },
        required: ['question', 'likelihood'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_party_state',
      description:
        'Look up the current party: names, classes, levels, HP/MP, AC, ability modifiers, gold, inventory, story flags, current location, and recent journal entries. Call this before narrating anything that depends on the party\'s condition, possessions, or past events, instead of guessing from memory. It is the source of truth.',
      parameters: { type: 'object', properties: {} },
    },
  },
] as const

export const SYSTEM_PROMPT = `You are the Dungeon Master for Nova Quest, a cozy-but-dangerous fantasy adventure that mixes D&D 5e rules with JRPG and visual-novel flair. The player is solo-playing a party in the valley of Oakhollow: the Sleepy Wyvern Inn, Oakhollow Market, the Whispering Mire (rogue myconids), and the Goblin Warren in the north-east highlands. Mira, the "hooded figure" at the inn, is actually an overworked ledger-keeper.

How to run the game:
- Never invent dice results. Whenever chance matters, call roll_dice and narrate from the actual result. A natural 20 is a critical success and a natural 1 is a critical failure. On a critical hit, roll damage with critical=true.
- When you are unsure what is true in the world (is the door locked? is anyone watching?), call ask_oracle with an honest likelihood and build on the answer, including any twist.
- Call get_party_state before narrating anything that depends on HP, levels, gold, inventory, story flags, or past events.
- Genre sense: never narrate what the characters cannot perceive. Hidden threats stay hidden until noticed. Writing "Unknown to Sven, goblins lie in wait" is forbidden; call for a Perception or Insight check instead.
- Avoid stale clichés (the mysterious hooded stranger, the tinkling lights in the forest) unless you are subverting them. Prefer specific, surprising, slightly funny details.
- Never decide what the party does. Describe, then ask. End every reply with a clear question or 2-4 numbered options.
- Keep replies short: 2-4 short paragraphs, second person, vivid. Use **bold** sparingly for names of people and places.
- The player also uses this app to get real work done. If they mention a real task, you may suggest posting it on the Quest Board, staying in character.`

const DICE_IN_TEXT = /\b(\d*d(?:\d+|%)(?:k[hl]\d+)?(?:\s*[+-]\s*\d+)*)\b/i

function asLikelihood(v: unknown): Likelihood {
  return LIKELIHOODS.some((l) => l.id === v) ? (v as Likelihood) : 'even'
}

export function executeTool(name: string, rawArgs: string, ctx: DmContext): { content: string; event: DmToolEvent } {
  let args: Record<string, unknown> = {}
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {}
  } catch {
    return { content: JSON.stringify({ error: 'Arguments were not valid JSON.' }), event: { name, summary: 'bad arguments' } }
  }

  if (name === 'roll_dice') {
    const notation = String(args.notation ?? '1d20')
    const mode = (['advantage', 'disadvantage'].includes(String(args.mode)) ? args.mode : 'normal') as RollMode
    try {
      const r = roll(notation, { mode, critical: Boolean(args.critical) })
      const summary = `${args.reason ? `${args.reason}: ` : ''}${formatRoll(r)}`
      ctx.log('roll', `DM roll - ${summary}`)
      return {
        content: JSON.stringify({
          notation,
          mode: r.mode,
          total: r.total,
          dice: r.dice.map((d) => ({ rolled: d.rolls, kept: d.kept })),
          modifier: r.modifier,
          natural: r.natural,
          critical_success: r.crit,
          critical_failure: r.fumble,
        }),
        event: { name, summary },
      }
    } catch (e) {
      return { content: JSON.stringify({ error: (e as Error).message }), event: { name, summary: `invalid dice "${notation}"` } }
    }
  }

  if (name === 'ask_oracle') {
    const question = String(args.question ?? 'Is it so?')
    const r = askOracle(question, asLikelihood(args.likelihood))
    const summary = `"${question}" -> ${r.answer}${r.twist ? ` (twist: ${r.twist})` : ''}`
    ctx.log('oracle', `DM oracle - ${summary}`)
    return { content: JSON.stringify({ answer: r.answer, roll: r.roll, threshold: r.threshold, twist: r.twist }), event: { name, summary } }
  }

  if (name === 'get_party_state') {
    return { content: JSON.stringify(ctx.getPartyState()), event: { name, summary: 'checked the party sheet' } }
  }

  return { content: JSON.stringify({ error: `Unknown tool ${name}` }), event: { name, summary: 'unknown tool' } }
}

interface ApiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface ApiMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: ApiToolCall[]
  tool_call_id?: string
}

const MAX_TOOL_ROUNDS = 6

export async function runDmTurn(
  history: ChatTurn[],
  config: DmConfig,
  ctx: DmContext,
  opts: { signal?: AbortSignal; fetchImpl?: typeof fetch } = {},
): Promise<DmTurnResult> {
  const doFetch = opts.fetchImpl ?? fetch
  const messages: ApiMessage[] = [{ role: 'system', content: SYSTEM_PROMPT }, ...history]
  const events: DmToolEvent[] = []
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`

  for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
    let res: Response
    try {
      res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({
          model: config.model,
          messages,
          tools: DM_TOOLS,
          tool_choice: round === MAX_TOOL_ROUNDS ? 'none' : 'auto',
          temperature: 0.9,
        }),
        signal: opts.signal,
      })
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      throw new Error(
        `Couldn't reach ${url} (${(e as Error).message}). Check the base URL, your connection, and that the API allows browser (CORS) requests.`,
      )
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`The DM's crystal ball is cloudy (HTTP ${res.status}). ${body.slice(0, 300)}`)
    }
    const data = (await res.json()) as { choices?: { message?: ApiMessage }[] }
    const msg = data.choices?.[0]?.message
    if (!msg) throw new Error('The DM returned an empty response.')

    if (msg.tool_calls?.length) {
      messages.push({ role: 'assistant', content: msg.content ?? null, tool_calls: msg.tool_calls })
      for (const call of msg.tool_calls) {
        const { content, event } = executeTool(call.function.name, call.function.arguments, ctx)
        events.push(event)
        messages.push({ role: 'tool', tool_call_id: call.id, content })
      }
      continue
    }
    return { reply: (msg.content ?? '').trim() || '...', events }
  }
  return { reply: 'The DM lost the thread. Try asking again.', events }
}

const SEED_PLACES = ['a flooded watchtower', 'a goblin-run toll bridge', 'an abandoned mushroom farm', 'a library that charges late fees in teeth', 'a caravan stuck in the Mire', 'a shrine where the statue keeps moving']
const SEED_TWISTS = ['someone is lying about the money', 'the monster is just hungry', 'an old rival got there first', 'the map is upside down', 'it is all a misfiled invoice', 'the weather turns at the worst moment']
const SEED_NPCS = ['a nervous halfling courier', 'a retired dragon-slayer with a bad knee', 'a goblin accountant on strike', 'a bard who only speaks in rhyme', 'twin myconids who disagree on everything']

/** Offline fallback: real dice and oracle, plus solo-play story seeds, with no network calls. */
export function offlineDmReply(text: string, ctx: DmContext): DmTurnResult {
  const dice = text.match(DICE_IN_TEXT)
  if (dice) {
    const mode: RollMode = /disadvantage/i.test(text) ? 'disadvantage' : /advantage/i.test(text) ? 'advantage' : 'normal'
    const { content, event } = executeTool('roll_dice', JSON.stringify({ notation: dice[1].replace(/\s+/g, ''), mode, reason: 'Player roll' }), ctx)
    const r = JSON.parse(content) as { total?: number; critical_success?: boolean; critical_failure?: boolean; error?: string }
    if (r.error) return { reply: `Those dice won't roll: ${r.error}`, events: [event] }
    const flavor = r.critical_success ? 'A natural 20! The table erupts.' : r.critical_failure ? 'A natural 1. Oof. Something goes hilariously wrong.' : 'The dice clatter to a stop.'
    return { reply: `${flavor} You rolled **${r.total}**. What happens next?`, events: [event] }
  }

  if (text.trim().endsWith('?')) {
    const l = LIKELIHOODS.find((x) => new RegExp(`\\b${x.label.replace('/', '\\/')}\\b`, 'i').test(text))
    const { content, event } = executeTool('ask_oracle', JSON.stringify({ question: text.trim(), likelihood: l?.id ?? 'even' }), ctx)
    const r = JSON.parse(content) as { answer: string; twist: string | null; roll: number }
    return {
      reply: `The oracle considers your question... **${r.answer}** (d100: ${r.roll})${r.twist ? `\n\nTwist: ${r.twist}` : ''}\n\nHow does that change things?`,
      events: [event],
    }
  }

  return {
    reply: `The offline DM offers a story seed: you come upon **${pick(SEED_PLACES)}**, where you meet **${pick(SEED_NPCS)}**, but ${pick(SEED_TWISTS)}.\n\nAsk a yes/no question (end with "?") for the oracle, or type dice like "roll 1d20+3". Add an API key in Settings to wake the full AI Dungeon Master.`,
    events: [],
  }
}
