import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Wallet,
} from "lucide-react";
import { useId, useMemo, useState } from "react";
import { addMonthsISO, formatDay, formatMonth, isISOMonth } from "@/lib/misdeudas/dates";
import { cents, money } from "@/lib/misdeudas/money";
import { summarizePayables } from "@/lib/misdeudas/payments";
import { useLedger } from "@/lib/misdeudas/store";
import type { Payable, Person } from "@/lib/misdeudas/types";
import { controlClass, Field, HorizontalRail, PressButton } from "./ui";

export function MonthlyPaymentsSummary({
  payables,
  peopleById,
  today,
  onAdd,
  onViewAll,
}: {
  payables: Payable[];
  peopleById: Map<string, Person>;
  today: string;
  onAdd: () => void;
  onViewAll: () => void;
}) {
  const headingId = useId();
  const [month, setMonth] = useState(today.slice(0, 7));
  const summary = useMemo(() => summarizePayables(payables, month), [payables, month]);
  const rows = [...summary.byPerson.values()].sort((a, b) =>
    (peopleById.get(a.personId)?.name ?? "").localeCompare(
      peopleById.get(b.personId)?.name ?? "",
      "es",
    ),
  );

  function moveMonth(offset: number) {
    const next = addMonthsISO(`${month}-01`, offset).slice(0, 7);
    if (isISOMonth(next)) setMonth(next);
  }

  return (
    <section className="payments-summary" aria-labelledby={headingId}>
      <div className="section-title-row">
        <span className="section-title-icon">
          <Wallet className="size-[1.125rem]" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id={headingId} className="font-display text-2xl leading-tight">
            Pagos por persona y mes
          </h2>
          <p className="text-sm text-mist">Lo que tú debes pagarle a cada persona.</p>
        </div>
      </div>
      <div className="payments-month-picker">
        <PressButton
          type="button"
          className="payments-month-arrow"
          aria-label="Mes anterior de pagos"
          disabled={month === "0100-01"}
          onClick={() => moveMonth(-1)}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </PressButton>
        <Field label="Mes de pagos">
          <input
            className={controlClass}
            type="month"
            min="0100-01"
            max="9999-12"
            value={month}
            onChange={(event) => {
              if (isISOMonth(event.target.value)) setMonth(event.target.value);
            }}
          />
        </Field>
        <PressButton
          type="button"
          className="payments-month-arrow"
          aria-label="Mes siguiente de pagos"
          disabled={month === "9999-12"}
          onClick={() => moveMonth(1)}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </PressButton>
      </div>
      <div className="payments-month-total" aria-live="polite">
        <div className="min-w-0">
          <p className="text-sm text-mist">Total pendiente · {formatMonth(month)}</p>
          <p className="font-display text-3xl tabular-nums text-pine">{money(summary.pending)}</p>
        </div>
        <p className="text-sm text-mist">
          {summary.pendingCount}{" "}
          {summary.pendingCount === 1 ? "compra por pagar" : "compras por pagar"}
          {summary.paid > 0 ? <span className="block">{money(summary.paid)} pagados</span> : null}
        </p>
      </div>
      {rows.length === 0 ? (
        <div className="payments-empty">
          <p className="text-sm text-mist">
            No tienes pagos registrados para {formatMonth(month)}.
          </p>
          <PressButton type="button" className="purchase-details-link mt-2" onClick={onAdd}>
            <Plus className="size-4" aria-hidden="true" /> Agregar pago
          </PressButton>
        </div>
      ) : (
        <div className="payments-person-grid">
          {rows.map((row) => (
            <article className="payments-person-total" key={row.personId}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="person-total-avatar" aria-hidden="true">
                  {(peopleById.get(row.personId)?.name ?? "P").slice(0, 1).toUpperCase()}
                </span>
                <h3 className="min-w-0 break-words font-semibold">
                  {peopleById.get(row.personId)?.name ?? "Persona"}
                </h3>
              </div>
              <p className="mt-3 font-display text-2xl tabular-nums text-clay">
                {money(row.pending)}
              </p>
              <p className="text-sm text-mist">
                {row.pendingCount === 0
                  ? "Todo pagado este mes"
                  : `${row.pendingCount} ${row.pendingCount === 1 ? "compra pendiente" : "compras pendientes"}`}
              </p>
              {row.nextDue ? (
                <p className="mt-1 text-xs text-mist">Próximo pago: {formatDay(row.nextDue)}</p>
              ) : null}
              {row.paid > 0 ? (
                <p className="mt-1 text-xs text-pine">Ya pagaste {money(row.paid)}</p>
              ) : null}
            </article>
          ))}
        </div>
      )}
      <div className="payments-summary-footer">
        <p className="text-xs leading-relaxed text-mist">
          Se agrupan por la fecha de pago. Los marcados como pagados ya no suman al pendiente.
        </p>
        <PressButton type="button" onClick={onViewAll} className="purchase-details-link shrink-0">
          Ver pagos <ArrowRight className="size-4" aria-hidden="true" />
        </PressButton>
      </div>
    </section>
  );
}

export function PaymentsPanel({
  payables,
  people,
  today,
  onAddPerson,
  onAdd,
  onEdit,
}: {
  payables: Payable[];
  people: Person[];
  today: string;
  onAddPerson: () => void;
  onAdd: (personId?: string) => void;
  onEdit: (id: string) => void;
}) {
  const setPaid = useLedger((state) => state.setPayablePaid);
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("");
  const [filter, setFilter] = useState<"pendientes" | "pagados" | "todos">("pendientes");
  const [message, setMessage] = useState("");
  const summary = useMemo(() => summarizePayables(payables), [payables]);
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const recipients = people.filter((person) => !person.isMe);
  const overdue = cents(
    payables.reduce(
      (sum, payable) => sum + (!payable.paid && payable.dueDate < today ? payable.amount : 0),
      0,
    ),
  );
  const needle = normalizeSearch(query.trim());
  const filtered = payables
    .filter((payable) => {
      if (filter === "pendientes" && payable.paid) return false;
      if (filter === "pagados" && !payable.paid) return false;
      if (month && payable.dueDate.slice(0, 7) !== month) return false;
      return normalizeSearch(
        `${payable.description} ${peopleById.get(payable.personId)?.name ?? ""}`,
      ).includes(needle);
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const filteredTotal = cents(filtered.reduce((sum, payable) => sum + payable.amount, 0));

  return (
    <div className="payments-layout">
      <section className="payables-overview" aria-label="Total de pagos a personas">
        <div className="min-w-0">
          <p className="text-sm font-medium text-mist">Total por pagar a personas</p>
          <p className="mt-1 font-display text-4xl tabular-nums text-pine">
            {money(summary.pending)}
          </p>
          <p className="mt-1 text-sm text-mist">
            {summary.pendingCount}{" "}
            {summary.pendingCount === 1 ? "compra pendiente" : "compras pendientes"} · todos los
            meses
          </p>
        </div>
        <span className="payables-overview-icon" aria-hidden="true">
          <Wallet className="size-7" />
        </span>
        {overdue > 0 ? (
          <p className="payables-overdue text-sm text-clay">
            {money(overdue)} con fecha de pago vencida
          </p>
        ) : null}
      </section>

      <section aria-label="Personas a quienes les pagas">
        <div className="payments-people-heading">
          <div className="min-w-0">
            <h2 className="font-display text-2xl">A quién le pagas</h2>
            <p className="text-sm text-mist">Agrega nombres aquí. También aparecen en Personas.</p>
          </div>
          <PressButton type="button" className="payments-secondary-button" onClick={onAddPerson}>
            <Plus className="size-4" aria-hidden="true" /> Agregar persona
          </PressButton>
        </div>
        {recipients.length === 0 ? (
          <p className="empty-state px-4 py-5 text-sm">
            Agrega una persona para registrar lo que tienes que pagarle.
          </p>
        ) : (
          <HorizontalRail label="Totales pendientes por persona" innerClassName="payee-track">
            {recipients.map((person) => {
              const row = summary.byPerson.get(person.id);
              return (
                <article className="payee-card" key={person.id}>
                  <h3 className="break-words font-semibold">{person.name}</h3>
                  <p className="mt-2 font-display text-2xl tabular-nums text-clay">
                    {money(row?.pending ?? 0)}
                  </p>
                  <p className="text-xs text-mist">pendiente · todos los meses</p>
                  <PressButton
                    type="button"
                    className="purchase-details-link mt-2"
                    onClick={() => onAdd(person.id)}
                    aria-label={`Agregar pago a ${person.name}`}
                  >
                    <Plus className="size-4" aria-hidden="true" /> Agregar pago
                  </PressButton>
                </article>
              );
            })}
          </HorizontalRail>
        )}
      </section>

      <section className="payments-records" aria-label="Compras que tienes que pagar">
        <div className="purchase-search">
          <Search className="size-5 shrink-0 text-pine" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar compra o persona"
            aria-label="Buscar pago por compra o persona"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-mist/80"
          />
          {query ? (
            <PressButton
              type="button"
              className="grid size-11 place-items-center rounded-full text-mist"
              aria-label="Limpiar búsqueda de pagos"
              onClick={() => setQuery("")}
            >
              <span aria-hidden="true">×</span>
            </PressButton>
          ) : null}
        </div>
        <div className="payments-record-filters">
          <HorizontalRail label="Estado de los pagos" innerClassName="filter-list">
            {(
              [
                ["pendientes", "Pendientes"],
                ["pagados", "Pagados"],
                ["todos", "Todos"],
              ] as const
            ).map(([id, label]) => (
              <PressButton
                key={id}
                type="button"
                aria-pressed={filter === id}
                onClick={() => setFilter(id)}
                className={`filter-chip ${filter === id ? "chip-active" : "chip-idle"}`}
              >
                {filter === id ? <Check className="size-4" aria-hidden="true" /> : null} {label}
              </PressButton>
            ))}
          </HorizontalRail>
          <Field label="Filtrar por mes" hint={month ? formatMonth(month) : "Todos los meses"}>
            <input
              className={controlClass}
              type="month"
              min="0100-01"
              max="9999-12"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          </Field>
          {month ? (
            <PressButton
              type="button"
              className="purchase-details-link"
              onClick={() => setMonth("")}
            >
              Ver todos los meses
            </PressButton>
          ) : null}
        </div>
        <p className="results-caption" aria-live="polite">
          {filtered.length} {filtered.length === 1 ? "pago" : "pagos"} · total{" "}
          {money(filteredTotal)}
        </p>
        {message ? (
          <p className="text-sm text-pine" role="status">
            {message}
          </p>
        ) : null}
        {filtered.length === 0 ? (
          <div className="payments-empty">
            <p className="text-sm text-mist">
              {payables.length === 0
                ? "Aún no registras compras que tengas que pagar. Agrega la primera con su importe y fecha."
                : "No hay pagos con estos filtros. Prueba otro mes o estado."}
            </p>
            <PressButton
              type="button"
              className="purchase-details-link mt-2"
              onClick={() => onAdd()}
            >
              <Plus className="size-4" aria-hidden="true" /> Agregar pago
            </PressButton>
          </div>
        ) : (
          <div className="payments-record-list">
            {filtered.map((payable) => {
              const expired = !payable.paid && payable.dueDate < today;
              return (
                <article className="payable-record" key={payable.id}>
                  <div className="payable-record-top">
                    <div className="min-w-0 flex-1">
                      <h3 className="break-words font-semibold">{payable.description}</h3>
                      <p className="break-words text-sm text-mist">
                        Le pagas a {peopleById.get(payable.personId)?.name ?? "Persona"}
                      </p>
                    </div>
                    <p
                      className={`font-display text-xl tabular-nums ${payable.paid ? "text-pine" : "text-clay"}`}
                    >
                      {money(payable.amount)}
                    </p>
                  </div>
                  <p
                    className={`mt-3 flex items-start gap-2 text-sm ${expired ? "text-clay" : "text-mist"}`}
                  >
                    {payable.paid ? (
                      <Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <CalendarDays className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    )}
                    {payable.paid ? "Pagado · fecha prevista" : expired ? "Venció el" : "Pagar el"}{" "}
                    {formatDay(payable.dueDate)}
                  </p>
                  <div className="payable-record-actions">
                    <PressButton
                      type="button"
                      className="payments-secondary-button"
                      onClick={() => onEdit(payable.id)}
                      aria-label={`Editar pago de ${payable.description}`}
                    >
                      Editar
                    </PressButton>
                    <PressButton
                      type="button"
                      className={`payments-status-button ${payable.paid ? "payments-status-undo" : ""}`}
                      aria-label={
                        payable.paid
                          ? `Marcar ${payable.description} como pendiente`
                          : `Marcar ${payable.description} como pagado`
                      }
                      onClick={() => {
                        setPaid(payable.id, !payable.paid);
                        setMessage(
                          `${payable.description}: ${payable.paid ? "vuelve a estar pendiente" : "marcado como pagado"}. Los totales se actualizaron.`,
                        );
                      }}
                    >
                      {payable.paid ? (
                        "Deshacer pago"
                      ) : (
                        <>
                          <Check className="size-4" aria-hidden="true" /> Marcar pagado
                        </>
                      )}
                    </PressButton>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}
