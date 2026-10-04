"use client";
import {
  Children,
  isValidElement,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { useOrganizationId } from "@/modules/access/organization-context";
import { useToast } from "@/modules/notifications/toast-provider";
import { searchReferences } from "./actions";
import type { ReferenceKind } from "./read-options";
export function ReferenceSearchSelect({
  children,
  defaultValue,
  kind,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { kind?: ReferenceKind }) {
  const scope = useOrganizationId(),
    notify = useToast();
  const inferred =
    kind ??
    (
      {
        clientId: "client",
        companyId: "company",
        dealId: "deal",
        ownerMemberId: "member",
      } as Record<string, ReferenceKind>
    )[props.name ?? ""];
  const [selectedLabel, setSelectedLabel] =
    useState<ReactNode>("Текущий выбор");
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(String(defaultValue ?? "")),
    [results, setResults] = useState<{ id: string; label: string }[] | null>(
      null,
    ),
    [pending, setPending] = useState(false);
  const initial = Children.toArray(children)
    .filter(isValidElement)
    .map(
      (child) =>
        child as React.ReactElement<{ value?: string; children?: ReactNode }>,
    );
  const selectedOption = initial.find(
    (child) => String(child.props.value ?? "") === selected,
  );
  async function runSearch() {
    if (!inferred || pending) return;

    setPending(true);
    try {
      const rows = await searchReferences({
        organizationId: scope,
        kind: inferred,
        query,
      });
      if (rows === null) {
        notify({
          kind: "error",
          message: "Список недоступен. Обновите страницу.",
        });
        return;
      }
      setResults(rows);
    } catch {
      notify({
        kind: "error",
        message: "Не удалось выполнить поиск.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      {!props.disabled && inferred && (
        <div className="mb-2 flex gap-2">
          <input
            aria-label="Поиск вариантов"
            value={query}
            maxLength={160}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void runSearch();
              }
            }}
            placeholder="Поиск по названию"
            className="min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending}
            className="rounded border px-3 py-2 text-sm disabled:opacity-50"
            onClick={runSearch}
          >
            {pending ? "Поиск…" : "Найти"}
          </button>
        </div>
      )}
      <select
        {...props}
        value={selected}
        onChange={(event) => {
          setSelected(event.target.value);
          setSelectedLabel(event.target.selectedOptions[0]?.textContent);
          props.onChange?.(event);
        }}
      >
        {results === null ? (
          children
        ) : (
          <>
            <option value="">Не выбрано</option>
            {selected &&
              !results.some((row) => row.id === selected) &&
              (selectedOption ?? (
                <option value={selected}>{selectedLabel}</option>
              ))}
            {results.map((row) => (
              <option key={row.id} value={row.id}>
                {row.label}
              </option>
            ))}
          </>
        )}
      </select>
      {results && (
        <p className="mt-1 text-xs text-slate-500">
          Найдено {results.length}
          {results.length === 50 ? " · уточните поиск" : ""}
        </p>
      )}
    </div>
  );
}
