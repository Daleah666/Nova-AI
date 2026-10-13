import { describe, expect, it, vi } from 'vitest'
import { DM_TOOLS, executeTool, offlineDmReply, runDmTurn, type DmContext } from './dm'

function ctx(): DmContext & { logs: string[] } {
  const logs: string[] = []
  return { logs, getPartyState: () => ({ party: [{ name: 'Sven', hp: '12/12' }], gold: 25 }), log: (_k, t) => logs.push(t) }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('DM tools', () => {
  it('describes each tool for the model', () => {
    expect(DM_TOOLS.map((t) => t.function.name)).toEqual(['roll_dice', 'ask_oracle', 'get_party_state'])
    for (const t of DM_TOOLS) expect(t.function.description.length).toBeGreaterThan(120)
  })

  it('roll_dice returns real results and logs them', () => {
    const c = ctx()
    const { content, event } = executeTool('roll_dice', JSON.stringify({ notation: '2d6+3', reason: 'Goblin damage' }), c)
    const r = JSON.parse(content)
    expect(r.total).toBeGreaterThanOrEqual(5)
    expect(r.total).toBeLessThanOrEqual(15)
    expect(event.summary).toMatch(/^Goblin damage: 2d6\+3/)
    expect(c.logs).toHaveLength(1)
  })

  it('reports bad input back to the model instead of throwing', () => {
    expect(JSON.parse(executeTool('roll_dice', '{"notation":"banana"}', ctx()).content).error).toBeTruthy()
    expect(JSON.parse(executeTool('roll_dice', '{not json', ctx()).content).error).toBeTruthy()
    expect(JSON.parse(executeTool('summon_tarrasque', '{}', ctx()).content).error).toMatch(/Unknown tool/)
  })

  it('ask_oracle and get_party_state return structured data', () => {
    const o = JSON.parse(executeTool('ask_oracle', '{"question":"Is it raining?","likelihood":"likely"}', ctx()).content)
    expect(o.threshold).toBe(75)
    expect(typeof o.answer).toBe('string')
    expect(JSON.parse(executeTool('get_party_state', '', ctx()).content).gold).toBe(25)
  })
})

describe('runDmTurn', () => {
  it('runs tool calls, feeds results back, and returns the final narration', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [
            {
              message: {
                role: 'assistant',
                content: null,
                tool_calls: [
                  { id: 'c1', type: 'function', function: { name: 'roll_dice', arguments: '{"notation":"1d20+5","reason":"Sven attacks"}' } },
                  { id: 'c2', type: 'function', function: { name: 'ask_oracle', arguments: '{"question":"Is the goblin alone?","likelihood":"unlikely"}' } },
                ],
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { role: 'assistant', content: 'Your blade flashes! What next?' } }] }))

    const result = await runDmTurn([{ role: 'user', content: 'I attack the goblin' }], { baseUrl: 'https://api.test/v1/', apiKey: 'k', model: 'm' }, ctx(), { fetchImpl })

    expect(result.reply).toBe('Your blade flashes! What next?')
    expect(result.events.map((e) => e.name)).toEqual(['roll_dice', 'ask_oracle'])
    expect(fetchImpl).toHaveBeenCalledTimes(2)
    const [url, init] = fetchImpl.mock.calls[1]
    expect(url).toBe('https://api.test/v1/chat/completions')
    const body = JSON.parse(String(init?.body))
    expect(body.messages[0].role).toBe('system')
    expect(body.messages.filter((m: { role: string }) => m.role === 'tool')).toHaveLength(2)
    expect((init!.headers as Record<string, string>).Authorization).toBe('Bearer k')
  })

  it('surfaces HTTP errors', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('bad key', { status: 401 }))
    await expect(runDmTurn([{ role: 'user', content: 'hi' }], { baseUrl: 'x', apiKey: 'k', model: 'm' }, ctx(), { fetchImpl })).rejects.toThrow(/401/)
  })

  it('explains network failures', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(
      runDmTurn([{ role: 'user', content: 'hi' }], { baseUrl: 'http://nope/v1/', apiKey: 'k', model: 'm' }, ctx(), { fetchImpl }),
    ).rejects.toThrow(/Couldn't reach http:\/\/nope\/v1\/chat\/completions.*CORS/)
  })
})

describe('offlineDmReply', () => {
  it('rolls dice found in the message', () => {
    const r = offlineDmReply('Sven swings: roll 1d20+5 with advantage', ctx())
    expect(r.events[0].name).toBe('roll_dice')
    expect(r.events[0].summary).toMatch(/advantage/)
  })

  it('asks the oracle for questions', () => {
    const r = offlineDmReply('Is there a goblin behind the boulder?', ctx())
    expect(r.events[0].name).toBe('ask_oracle')
    expect(r.reply).toMatch(/oracle/)
  })

  it('offers a story seed otherwise', () => {
    const r = offlineDmReply('We head into the forest', ctx())
    expect(r.events).toHaveLength(0)
    expect(r.reply).toMatch(/story seed/)
  })
})
