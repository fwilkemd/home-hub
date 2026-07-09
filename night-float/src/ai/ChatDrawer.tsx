/**
 * Optional LLM chat dock (SPEC §11.3, OFF by default): a bottom-right button
 * + drawer for free-text chat with nurse / consultant / family. Loaded via
 * React.lazy from App, so it costs nothing while disabled. Tool-use replies
 * are validated then dispatched as ordinary VerbalOrder commands.
 */
import { useEffect, useRef, useState } from 'react';
import { hubStore } from '../bridge/store';
import { dispatch } from '../bridge/session';
import type { VerbalOrder } from '../contracts/orders';
import { drugs, getDrug } from '../data/drugs';
import { labPanels, getLabPanel } from '../data/labs';
import { describeEvent, fmtNum, wallClock } from '../ui/format';
import { IconChat, IconX } from '../ui/icons';
import {
  CHAT_ROLE_LABELS,
  sendChat,
  type ApiMessage,
  type ChatRole,
} from './anthropic';

interface Line {
  id: number;
  who: 'you' | 'them' | 'system';
  text: string;
}

/** Compact structured sim context the model receives every turn. */
function buildContextJson(): string {
  const s = hubStore.getState();
  const v = s.vitals;
  const ctx = {
    wallClock: wallClock(s.clockStart, s.simTime),
    patient: s.patient
      ? {
          name: s.patient.demographics.name,
          age: s.patient.demographics.age,
          sex: s.patient.demographics.sex,
          weightKg: s.patient.demographics.weightKg,
        }
      : null,
    vitals: v
      ? {
          hr: Math.round(v.hr),
          rhythm: v.rhythm,
          bp: `${Math.round(v.sbp)}/${Math.round(v.dbp)}`,
          map: Math.round(v.map),
          spo2: Math.round(v.spo2),
          rr: Math.round(v.rr),
          tempC: Number(v.tempC.toFixed(1)),
        }
      : null,
    activeAlarms: s.alarms.map((a) => ({ label: a.label, priority: a.priority })),
    infusions: (s.patient?.infusions ?? []).map((i) => ({
      infusionId: i.id,
      drug: getDrug(i.drugId)?.name ?? i.drugId,
      rate: i.doseRate,
      unit: i.doseUnit,
    })),
    availableDrugs: drugs.slice(0, 16).map((d) => ({
      drugId: d.id,
      name: d.name,
      bolus: d.bolus ? `${d.bolus.min}-${d.bolus.max} ${d.bolus.doseUnit}` : null,
    })),
    availableLabPanels: labPanels.slice(0, 16).map((p) => ({ panelId: p.id, name: p.name })),
    recentEvents: s.events.slice(-12).map((e) => ({
      t: wallClock(s.clockStart, e.t, false),
      what: describeEvent(e) ?? e.type,
    })),
  };
  return JSON.stringify(ctx);
}

function describeVerbal(v: VerbalOrder): string {
  switch (v.kind) {
    case 'push_med':
      return `push ${getDrug(v.drugId)?.name ?? v.drugId} ${fmtNum(v.dose)}`;
    case 'bolus_fluids':
      return `bolus ${v.volumeMl} mL fluids`;
    case 'titrate':
      return `titrate infusion ${v.deltaSteps > 0 ? 'up' : 'down'} ${Math.abs(v.deltaSteps)} step(s)`;
    case 'stat_lab':
      return `STAT ${getLabPanel(v.panelId)?.name ?? v.panelId}`;
    case 'call_rt':
      return 'call respiratory therapy';
    case 'cycle_nibp':
      return 'cycle NIBP';
  }
}

let lineId = 0;
const emptyThreads = (): Record<ChatRole, Line[]> => ({ nurse: [], consultant: [], family: [] });
const emptyHistories = (): Record<ChatRole, ApiMessage[]> => ({
  nurse: [],
  consultant: [],
  family: [],
});
const emptyPending = (): Record<ChatRole, unknown[]> => ({ nurse: [], consultant: [], family: [] });

function ChatDrawer({ onClose }: { onClose: () => void }) {
  const [role, setRole] = useState<ChatRole>('nurse');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [threads, setThreads] = useState<Record<ChatRole, Line[]>>(emptyThreads);
  const historiesRef = useRef<Record<ChatRole, ApiMessage[]>>(emptyHistories());
  const pendingToolResultsRef = useRef<Record<ChatRole, unknown[]>>(emptyPending());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const lines = threads[role];

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const addLine = (r: ChatRole, who: Line['who'], text: string) => {
    setThreads((prev) => ({ ...prev, [r]: [...prev[r], { id: ++lineId, who, text }] }));
  };

  const send = async () => {
    const msg = input.trim();
    if (!msg || busy) return;
    setInput('');
    addLine(role, 'you', msg);
    setBusy(true);

    const hist = historiesRef.current[role];
    const pending = pendingToolResultsRef.current[role];
    pendingToolResultsRef.current[role] = [];
    // tool_result blocks (from the previous turn's orders) must lead the turn
    const userContent: string | unknown[] =
      pending.length > 0 ? [...pending, { type: 'text', text: msg }] : msg;
    hist.push({ role: 'user', content: userContent });

    try {
      const turn = await sendChat({
        apiKey: hubStore.getState().settings.llmKey.trim(),
        role,
        contextJson: buildContextJson(),
        messages: hist,
      });
      hist.push({ role: 'assistant', content: turn.assistantContent });

      if (turn.text) addLine(role, 'them', turn.text);
      for (const o of turn.orders) {
        dispatch({ type: 'VerbalOrder', verbal: o.verbal });
        addLine(role, 'system', `Verbal order executed — ${describeVerbal(o.verbal)}`);
        pendingToolResultsRef.current[role].push({
          type: 'tool_result',
          tool_use_id: o.toolUseId,
          content: 'Order acknowledged and carried out in the simulation.',
        });
      }
      for (const id of turn.invalidToolUses) {
        addLine(role, 'system', 'Ignored an invalid order from the model.');
        pendingToolResultsRef.current[role].push({
          type: 'tool_result',
          tool_use_id: id,
          content: 'Invalid order — not executed.',
          is_error: true,
        });
      }
      if (!turn.text && turn.orders.length === 0 && turn.invalidToolUses.length === 0) {
        addLine(role, 'system', '(no reply)');
      }
    } catch (err) {
      // roll the failed turn back so history stays API-valid for a retry
      hist.pop();
      pendingToolResultsRef.current[role] = pending;
      addLine(role, 'system', `Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-drawer" role="dialog" aria-label="Comms">
      <div className="chat-head">
        <select
          value={role}
          onChange={(e) => setRole(e.currentTarget.value as ChatRole)}
          aria-label="Who to talk to"
        >
          {(Object.keys(CHAT_ROLE_LABELS) as ChatRole[]).map((r) => (
            <option key={r} value={r}>
              {CHAT_ROLE_LABELS[r]}
            </option>
          ))}
        </select>
        <button className="iconbtn" onClick={onClose} aria-label="Close comms">
          <IconX />
        </button>
      </div>

      <div className="chat-lines scroll" ref={scrollRef}>
        {lines.length === 0 && (
          <div className="chat-line system">
            Free-text channel — orders still go through the same structured verbal-order pipeline.
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className={`chat-line ${l.who}`}>
            {l.text}
          </div>
        ))}
        {busy && <div className="chat-line system">…</div>}
      </div>

      <form
        className="chat-inputrow"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="input"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          placeholder={`Say something to the ${role}…`}
          aria-label="Message"
          disabled={busy}
        />
        <button className="btn acc" type="submit" disabled={busy || input.trim().length === 0}>
          Send
        </button>
      </form>
      <div className="chat-hint">claude-sonnet-5 · key stays in this browser</div>
    </div>
  );
}

/** Default export for React.lazy: the floating button + drawer. */
export default function ChatDock() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="chat-fab" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <IconChat />
        Comms
      </button>
      {open && <ChatDrawer onClose={() => setOpen(false)} />}
    </>
  );
}
