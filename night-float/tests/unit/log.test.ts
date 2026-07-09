import { describe, expect, it } from 'vitest';
import { EventLog, matchWhere } from '../../src/engine/log';

describe('EventLog', () => {
  it('appends with monotonic seq and notifies listeners', () => {
    const log = new EventLog();
    const seen: number[] = [];
    log.onAppend((e) => seen.push(e.seq));
    log.append(0, { type: 'NoteWritten', text: 'a' });
    log.append(1, { type: 'NoteWritten', text: 'b' });
    expect(log.all().length).toBe(2);
    expect(seen).toEqual([0, 1]);
    expect(log.all()[1].t).toBe(1);
  });

  it('matchWhere supports dot paths', () => {
    const log = new EventLog();
    const e = log.append(3, {
      type: 'OrderPlaced',
      order: {
        id: 'ord-1',
        t: 3,
        status: 'active',
        kind: 'lab',
        panelId: 'bmp',
        stat: true,
        label: 'BMP stat',
      },
    });
    expect(matchWhere(e, { 'order.kind': 'lab' })).toBe(true);
    expect(matchWhere(e, { 'order.kind': 'med' })).toBe(false);
    expect(log.findLast('OrderPlaced', { 'order.panelId': 'bmp' })).toBeDefined();
    expect(log.count('OrderPlaced')).toBe(1);
  });
});
