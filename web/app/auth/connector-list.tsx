import type { Connector } from "wagmi";

interface ConnectorListProps {
  connectors: readonly Connector[];
  onSelect: (connector: Connector) => void;
  disabled?: boolean;
}

export function ConnectorList({ connectors, onSelect, disabled }: ConnectorListProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          type="button"
          onClick={() => onSelect(connector)}
          disabled={disabled}
          className="flex items-center gap-3 rounded px-3 py-2 text-left text-sm font-medium text-amber-200/80 hover:bg-stone-700 disabled:opacity-50"
        >
          {connector.icon ? (
            <img src={connector.icon} alt="" className="h-5 w-5 rounded" />
          ) : (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-stone-700 text-[13px] font-semibold text-amber-200/70">
              {connector.name.slice(0, 1)}
            </span>
          )}
          {connector.name}
        </button>
      ))}
    </div>
  );
}
