/**
 * Orders tab — the main "act" verb. Search, favorites, recents, grouped
 * orderables (left) and the active-orders table (right). Clicking anything
 * opens the composer dialog; signing dispatches PlaceOrder.
 */
import { useMemo, useState } from 'react';
import { useHub } from '../../bridge/store';
import { dispatch } from '../../bridge/session';
import type { Order, OrderDraft } from '../../contracts/orders';
import {
  buildFavorites,
  buildOrderables,
  ORDER_GROUPS,
  seedFromOrder,
  type Orderable,
} from './orderables';
import { OrderComposer } from './OrderComposer';
import { ActiveOrders } from './ActiveOrders';

function cloneDraft(order: Order): OrderDraft {
  const { id: _id, t: _t, status: _status, ...draft } = order;
  return draft;
}

export function OrdersTab() {
  const [query, setQuery] = useState('');
  const [seed, setSeed] = useState<Orderable | null>(null);
  const orders = useHub((s) => s.orders);

  const all = useMemo(buildOrderables, []);
  const favorites = useMemo(() => buildFavorites(all), [all]);

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: Order[] = [];
    for (let i = orders.length - 1; i >= 0 && out.length < 6; i--) {
      const o = orders[i];
      if (seen.has(o.label)) continue;
      seen.add(o.label);
      out.push(o);
    }
    return out;
  }, [orders]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter((o) => `${o.title} ${o.sub} ${o.group}`.toLowerCase().includes(q))
    : all;

  const reorder = (order: Order) => {
    const resolved = seedFromOrder(order, all);
    if (resolved) setSeed(resolved);
    else dispatch({ type: 'PlaceOrder', draft: cloneDraft(order) });
  };

  return (
    <div className="orders">
      <div className="orders-left">
        <input
          className="input"
          type="search"
          placeholder="Search orders — meds, labs, imaging, vent, nursing…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          aria-label="Search orders"
        />

        {favorites.length > 0 && (
          <div className="ordgroup">
            <h4>Favorites</h4>
            <div className="chiprow">
              {favorites.map((f) => (
                <button key={f.key} className="chipbtn" onClick={() => setSeed(f)}>
                  {f.title}
                </button>
              ))}
            </div>
          </div>
        )}

        {recents.length > 0 && (
          <div className="ordgroup">
            <h4>Recent</h4>
            <div className="chiprow">
              {recents.map((o) => (
                <button key={o.id} className="chipbtn" onClick={() => reorder(o)} title="Reorder">
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {filtered.length === 0 && (
          <p className="empty">
            {all.length === 0
              ? 'No orderables yet — the drug/lab registries are still empty (content workstream).'
              : 'Nothing matches that search.'}
          </p>
        )}

        {ORDER_GROUPS.map((group) => {
          const items = filtered.filter((o) => o.group === group);
          if (items.length === 0) return null;
          return (
            <div key={group} className="ordgroup">
              <h4>{group}</h4>
              <div className="ordgrid">
                {items.map((o) => (
                  <button key={o.key} className="ordbtn" onClick={() => setSeed(o)}>
                    <span className="ordbtn-title">{o.title}</span>
                    <span className="ordbtn-sub">{o.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="orders-right">
        <ActiveOrders />
      </div>

      {seed && <OrderComposer key={seed.key} seed={seed} onClose={() => setSeed(null)} />}
    </div>
  );
}
