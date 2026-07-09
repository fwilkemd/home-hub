/**
 * Bottom-center tool hotbar (1-6). Clicking equips/unequips like the digits.
 */
import { useHub } from '../../bridge/store';
import { equipTool, HOTBAR_TOOLS, TOOL_SHORT } from '../tools';
import { TOOL_LABELS } from '../../contracts/ids';

export function Hotbar() {
  const held = useHub((s) => s.heldTool);
  return (
    <div className="hotbar" role="toolbar" aria-label="Tools">
      {HOTBAR_TOOLS.map((tool, i) => (
        <button
          key={tool}
          className={`slot ${held === tool ? 'held' : ''}`}
          onClick={() => equipTool(tool)}
          aria-pressed={held === tool}
          title={TOOL_LABELS[tool]}
        >
          <span className="kc">{i + 1}</span>
          <span className="slot-name">{TOOL_SHORT[tool]}</span>
        </button>
      ))}
    </div>
  );
}
