import type { Ability } from './rules'

export type Effect =
  | { type: 'gold'; amount: number }
  | { type: 'xp'; amount: number }
  | { type: 'item'; id: string; count: number }
  | { type: 'flag'; id: string }
  | { type: 'rest' }
  | { type: 'journal'; text: string }

/** Gold requirements show the choice disabled; flag requirements hide it entirely. */
export interface Requirement {
  gold?: number
  flags?: string[]
  notFlags?: string[]
}

export interface Check {
  ability: Ability
  dc: number
  label: string
  success: string
  failure: string
}

export interface Choice {
  text: string
  next?: string
  check?: Check
  requires?: Requirement
  effects?: Effect[]
}

export interface SceneNode {
  /** NPC id, 'lead' for the party leader, or omitted for the narrator. */
  speaker?: string
  /** NPC to keep on screen during narration. */
  show?: string
  text: string
  next?: string
  choices?: Choice[]
  battle?: { enemies: string[]; victory: string; canFlee?: boolean; ambush?: boolean }
  effects?: Effect[]
}

export interface Scene {
  id: string
  title: string
  bg: 'tavern' | 'market' | 'mire' | 'warren' | 'lair'
  start: string
  /** First matching entry wins; falls back to `start`. */
  startIf?: { all?: string[]; none?: string[]; node: string }[]
  nodes: Record<string, SceneNode>
}

export function flagsMatch(flags: Record<string, boolean>, all: string[] = [], none: string[] = []): boolean {
  return all.every((f) => flags[f]) && none.every((f) => !flags[f])
}

export function entryNode(scene: Scene, flags: Record<string, boolean>): string {
  return scene.startIf?.find((s) => flagsMatch(flags, s.all, s.none))?.node ?? scene.start
}

export function choiceVisible(choice: Choice, flags: Record<string, boolean>): boolean {
  return flagsMatch(flags, choice.requires?.flags, choice.requires?.notFlags)
}

export function choiceAffordable(choice: Choice, gold: number): boolean {
  return gold >= (choice.requires?.gold ?? 0)
}

export function isTerminal(node: SceneNode): boolean {
  return !node.next && !node.choices?.length && !node.battle
}

export function interpolate(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
