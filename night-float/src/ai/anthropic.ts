/**
 * Minimal browser-side Anthropic Messages API client for the optional chat
 * module (SPEC §11.3). Raw fetch on purpose: no new dependencies, and the key
 * lives only in this browser. The single `verbal_order` tool mirrors the
 * VerbalOrder union, so the model can ONLY act through the same structured
 * orders as the radial menu.
 */
import type { VerbalOrder } from '../contracts/orders';

export type ChatRole = 'nurse' | 'consultant' | 'family';

export const CHAT_ROLE_LABELS: Record<ChatRole, string> = {
  nurse: 'Nurse (bedside)',
  consultant: 'Consultant (phone)',
  family: 'Family (phone)',
};

/** API message shape we exchange (content blocks stay opaque `unknown`). */
export interface ApiMessage {
  role: 'user' | 'assistant';
  content: string | unknown[];
}

interface TextBlock {
  type: 'text';
  text: string;
}
interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

const VERBAL_ORDER_TOOL = {
  name: 'verbal_order',
  description:
    'Carry out a structured verbal order in the ICU simulation. This is the ONLY way to act on ' +
    'the patient. Use ids exactly as given in the sim context JSON. Only place orders the ' +
    'physician actually asked for (or clearly agreed to).',
  input_schema: {
    type: 'object',
    properties: {
      kind: {
        type: 'string',
        enum: ['push_med', 'bolus_fluids', 'titrate', 'stat_lab', 'call_rt', 'cycle_nibp'],
        description: 'Which structured order to execute.',
      },
      drugId: { type: 'string', description: 'push_med: drug id from context.availableDrugs' },
      dose: { type: 'number', description: 'push_med: dose in the drug bolus unit' },
      volumeMl: { type: 'number', description: 'bolus_fluids: crystalloid volume in mL' },
      infusionId: {
        type: 'string',
        description: 'titrate: infusion id from context.infusions (NOT the drug id)',
      },
      deltaSteps: { type: 'number', description: 'titrate: +1 = up one step, -1 = down one step' },
      panelId: { type: 'string', description: 'stat_lab: panel id from context.availableLabPanels' },
    },
    required: ['kind'],
  },
} as const;

/** Strict deterministic validation of a tool_use input into a VerbalOrder. */
export function parseVerbalOrder(input: Record<string, unknown>): VerbalOrder | null {
  const num = (v: unknown): number | null =>
    typeof v === 'number' && Number.isFinite(v) ? v : null;
  const str = (v: unknown): string | null =>
    typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
  switch (input.kind) {
    case 'push_med': {
      const drugId = str(input.drugId);
      const dose = num(input.dose);
      return drugId && dose !== null && dose > 0 ? { kind: 'push_med', drugId, dose } : null;
    }
    case 'bolus_fluids': {
      const volumeMl = num(input.volumeMl);
      return volumeMl !== null && volumeMl > 0 ? { kind: 'bolus_fluids', volumeMl } : null;
    }
    case 'titrate': {
      const infusionId = str(input.infusionId);
      const deltaSteps = num(input.deltaSteps);
      return infusionId && deltaSteps !== null && deltaSteps !== 0
        ? { kind: 'titrate', infusionId, deltaSteps }
        : null;
    }
    case 'stat_lab': {
      const panelId = str(input.panelId);
      return panelId ? { kind: 'stat_lab', panelId } : null;
    }
    case 'call_rt':
      return { kind: 'call_rt' };
    case 'cycle_nibp':
      return { kind: 'cycle_nibp' };
    default:
      return null;
  }
}

const PERSONAS: Record<ChatRole, string> = {
  nurse:
    'You are the experienced ICU night nurse in the room with the physician (the player). ' +
    'You are calm, practical, and brief — one or two short sentences. When the physician gives a ' +
    'clear order, acknowledge it and execute it with the verbal_order tool. If an order is ' +
    'ambiguous or unsafe-sounding, ask one short clarifying question instead.',
  consultant:
    'You are the critical-care consultant on the phone at 3am, woken from sleep. You are terse but ' +
    'helpful, thinking out loud in short sentences. You may recommend management; if the caller ' +
    'explicitly asks you to put an order in, use the verbal_order tool.',
  family:
    "You are the patient's adult child, reached by phone in the middle of the night. You are " +
    'worried and not medically trained. Ask human questions, react emotionally but believably. ' +
    'You cannot place orders and should never talk in clinical jargon.',
};

export interface ChatTurn {
  /** Concatenated text blocks (may be empty when the model only acted). */
  text: string;
  /** Validated structured orders the model asked to execute. */
  orders: { verbal: VerbalOrder; toolUseId: string }[];
  /** tool_use ids whose input failed validation (need error tool_results). */
  invalidToolUses: string[];
  /** Raw assistant content blocks — push back into history verbatim. */
  assistantContent: unknown[];
}

/**
 * One Messages API round trip. Throws Error with a readable message on any
 * HTTP/network failure — callers render it inline (never console.error).
 */
export async function sendChat(opts: {
  apiKey: string;
  role: ChatRole;
  contextJson: string;
  messages: ApiMessage[];
  signal?: AbortSignal;
}): Promise<ChatTurn> {
  const system =
    `${PERSONAS[opts.role]}\n\n` +
    'Setting: "Night Float", a first-person ICU training simulation (a game — no real patient). ' +
    'Stay in character; never mention being an AI or a simulation. Keep every reply under 60 words.\n\n' +
    `Current sim context (JSON):\n${opts.contextJson}`;

  const body: Record<string, unknown> = {
    model: 'claude-sonnet-5',
    max_tokens: 400,
    system,
    messages: opts.messages,
  };
  // Family can't execute orders — the tool is only offered to clinical roles.
  if (opts.role !== 'family') body.tools = [VERBAL_ORDER_TOOL];

  let res: Response;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
  } catch (err) {
    throw new Error(
      `network error reaching api.anthropic.com (${err instanceof Error ? err.message : String(err)})`,
      { cause: err },
    );
  }

  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const parsed = (await res.json()) as { error?: { message?: string } };
      if (parsed.error?.message) detail = `HTTP ${res.status} — ${parsed.error.message}`;
    } catch {}
    throw new Error(detail);
  }

  const data = (await res.json()) as {
    content?: unknown[];
    stop_reason?: string;
  };
  const blocks = Array.isArray(data.content) ? data.content : [];

  const text = blocks
    .filter((b): b is TextBlock => (b as TextBlock)?.type === 'text' && typeof (b as TextBlock).text === 'string')
    .map((b) => b.text)
    .join('\n')
    .trim();

  const orders: ChatTurn['orders'] = [];
  const invalidToolUses: string[] = [];
  for (const b of blocks) {
    const tu = b as ToolUseBlock;
    if (tu?.type !== 'tool_use' || typeof tu.id !== 'string') continue;
    const verbal = parseVerbalOrder((tu.input ?? {}) as Record<string, unknown>);
    if (verbal) orders.push({ verbal, toolUseId: tu.id });
    else invalidToolUses.push(tu.id);
  }

  if (data.stop_reason === 'refusal' && !text && orders.length === 0) {
    return {
      text: '(no answer — the model declined this request)',
      orders: [],
      invalidToolUses,
      assistantContent: blocks,
    };
  }

  return { text, orders, invalidToolUses, assistantContent: blocks };
}
