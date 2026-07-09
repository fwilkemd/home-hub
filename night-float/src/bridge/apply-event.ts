/**
 * SimEvent -> store reducer. Every event appended by the engine flows through
 * here exactly once (synchronously). Defines the UI-visible semantics of the
 * event stream; the engine never touches the store directly.
 */
import type { SimEvent } from '../contracts/events';
import type { MarEntry } from '../contracts/orders';
import type { EngineHandle, MediaItem } from '../contracts/runtime';
import { hubStore, hubActions } from './store';
import { bus } from './bus';
import { paintCxr, takeClipDataUrl } from './media';

const FLOWSHEET_CAP = 6000; // ~8h of 5s snapshots

function pushMar(entry: Omit<MarEntry, 'id'>): void {
  hubStore.setState((s) => ({
    mar: [...s.mar, { ...entry, id: `mar-${s.mar.length + 1}` }],
  }));
}

export function applySimEvent(e: SimEvent, engine: EngineHandle): void {
  // Every event lands in the mirrored log (debrief reads the engine's copy,
  // the UI ticker reads this one).
  hubStore.setState((s) => ({ events: [...s.events, e] }));

  switch (e.type) {
    // ------------------------------------------------------------ orders
    case 'OrderPlaced':
      hubStore.setState((s) => ({ orders: [...s.orders, e.order] }));
      break;
    case 'OrderModified':
      hubStore.setState((s) => ({
        orders: s.orders.map((o) => (o.id === e.orderId ? { ...o, label: e.label } : o)),
      }));
      break;
    case 'OrderDiscontinued':
      hubStore.setState((s) => ({
        orders: s.orders.map((o) =>
          o.id === e.orderId ? { ...o, status: 'discontinued' as const } : o,
        ),
      }));
      break;
    case 'OrderCompleted':
      hubStore.setState((s) => ({
        orders: s.orders.map((o) =>
          o.id === e.orderId ? { ...o, status: 'completed' as const } : o,
        ),
      }));
      break;

    // ------------------------------------------------------------ meds
    case 'MedAdministered':
      pushMar({
        t: e.t,
        drugId: e.drugId,
        label: `${e.drugName} ${e.dose} ${e.unit} ${e.route}`,
        kind: 'bolus',
        dose: e.dose,
        unit: e.unit,
        route: e.route,
        by: e.by,
      });
      break;
    case 'InfusionStarted':
      pushMar({ t: e.t, drugId: e.infusion.drugId, label: e.label, kind: 'infusion_start', by: 'nurse' });
      break;
    case 'InfusionRateChanged':
      pushMar({ t: e.t, drugId: e.drugId, label: e.label, kind: 'infusion_change', by: 'nurse' });
      break;
    case 'InfusionStopped':
      pushMar({ t: e.t, drugId: e.drugId, label: e.label, kind: 'infusion_stop', by: 'nurse' });
      break;

    // ------------------------------------------------------------ vitals
    case 'VitalsSnapshot': {
      const v = e.vitals;
      hubStore.setState((s) => {
        const point = {
          t: e.t,
          hr: v.hr,
          map: v.map,
          sbp: v.sbp,
          dbp: v.dbp,
          spo2: v.spo2,
          rr: v.rr,
          tempC: v.tempC,
          etco2: v.etco2,
          source: 'auto' as const,
        };
        const flowsheet =
          s.flowsheet.length >= FLOWSHEET_CAP
            ? [...s.flowsheet.slice(-FLOWSHEET_CAP + 1), point]
            : [...s.flowsheet, point];
        return { flowsheet };
      });
      break;
    }
    case 'NibpMeasured': {
      const v = hubStore.getState().vitals;
      hubStore.setState((s) => ({
        flowsheet: [
          ...s.flowsheet,
          {
            t: e.t,
            hr: v?.hr ?? 0,
            map: e.map,
            sbp: e.sbp,
            dbp: e.dbp,
            spo2: v?.spo2 ?? 0,
            rr: v?.rr ?? 0,
            tempC: v?.tempC ?? 0,
            source: 'nibp' as const,
          },
        ],
      }));
      break;
    }

    // ------------------------------------------------------------ alarms
    case 'AlarmRaised':
      if (e.priority === 'crisis' || e.priority === 'warning') {
        hubActions.toast(e.label, 'alarm', 6000);
      }
      break;

    // ------------------------------------------------------------ labs
    case 'LabOrdered':
      hubStore.setState((s) => ({
        pendingLabs: [
          ...s.pendingLabs,
          {
            orderId: e.orderId,
            panelId: e.panelId,
            panelName: e.panelName,
            stat: e.stat,
            resultsAt: e.resultsAt,
          },
        ],
      }));
      break;
    case 'LabResulted': {
      hubStore.setState((s) => ({
        pendingLabs: s.pendingLabs.filter((p) => p.orderId !== e.orderId),
        labResults: [
          ...s.labResults,
          {
            id: e.orderId,
            t: e.t,
            panelId: e.panelId,
            panelName: e.panelName,
            stat: e.stat,
            results: e.results,
          },
        ],
      }));
      const abnormal = e.results.filter((r) => r.flag !== 'normal').length;
      hubActions.toast(
        `${e.panelName} resulted${abnormal ? ` — ${abnormal} abnormal` : ''}`,
        'info',
        6000,
      );
      if (e.stat) bus.emit('chime', { kind: 'result' });
      break;
    }
    case 'ImagingResulted': {
      const dataUrl = paintCxr(engine.getPatient(), e.findingsText, engine.scenario.seed);
      const item: MediaItem = {
        id: e.mediaId,
        t: e.t,
        kind: 'cxr',
        label: e.study.toUpperCase(),
        dataUrl,
        findingsText: e.findingsText,
      };
      hubStore.setState((s) => ({ media: [...s.media, item] }));
      hubActions.toast(`${e.study.toUpperCase()} resulted`, 'info', 6000);
      break;
    }

    // ------------------------------------------------------------ bedside
    case 'ExamPerformed':
      hubStore.setState({
        lastExam: { zone: e.zone, mode: e.mode, text: e.findingsText, untilReal: Date.now() + 9000 },
      });
      break;
    case 'UsClipSaved': {
      const dataUrl = takeClipDataUrl();
      if (dataUrl) {
        const item: MediaItem = {
          id: e.mediaId,
          t: e.t,
          kind: 'us_still',
          label: `US — ${e.view}`,
          view: e.view,
          dataUrl,
        };
        hubStore.setState((s) => ({ media: [...s.media, item] }));
        hubActions.toast('Clip saved to Media', 'success', 3000);
      }
      break;
    }
    case 'NoteWritten':
      hubStore.setState((s) => ({
        notes: [...s.notes, { id: `note-${s.notes.length + 1}`, t: e.t, text: e.text }],
      }));
      break;

    // ------------------------------------------------------------ machinery
    case 'TimeScaleChanged':
      hubStore.setState({ timeScale: e.scale });
      if (e.auto) {
        bus.emit('chime', { kind: 'timeDrop' });
        if (e.reason) hubActions.toast(`Dropped to 1× — ${e.reason}`, 'info', 4000);
      }
      break;
    case 'ScenarioScriptedEvent':
      if (e.label) hubActions.toast(e.label, 'info', 6000);
      break;
    case 'NurseSpeech':
      hubStore.setState((s) => ({
        nurse: { ...s.nurse, say: e.say, sayUntilReal: Date.now() + 6000 },
      }));
      break;
    case 'NurseAction':
      if (e.say) {
        hubStore.setState((s) => ({
          nurse: { ...s.nurse, say: e.say ?? null, sayUntilReal: Date.now() + 6000 },
        }));
      }
      break;

    default:
      break;
  }

  bus.emit('simEvent', e);
}
