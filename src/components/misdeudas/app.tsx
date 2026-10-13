import {
  CreditCard,
  LayoutDashboard,
  Plus,
  Receipt,
  Settings as SettingsIcon,
  Shield,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { dashboard, viewPurchase, type PurchaseView } from "@/lib/misdeudas/calc";
import { formatDay, formatDayShort, todayISO } from "@/lib/misdeudas/dates";
import { loadHolidays, type HolidaySource } from "@/lib/misdeudas/holidays";
import { formatPercent, money } from "@/lib/misdeudas/money";
import { exportPayload, useLedger } from "@/lib/misdeudas/store";
import type { Card, Holiday, Person, TabId } from "@/lib/misdeudas/types";
import { CardForm, PersonForm, PurchaseForm } from "./forms";
import { PressButton, Progress, Sheet } from "./ui";

const TABS: { id: TabId; label: string; icon: typeof Receipt }[] = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "compras", label: "Compras", icon: Receipt },
  { id: "personas", label: "Personas", icon: Users },
  { id: "tarjetas", label: "Tarjetas", icon: CreditCard },
  { id: "ajustes", label: "Ajustes", icon: SettingsIcon },
];

export function MisDeudasApp() {
  const hydrated = useLedger((state) => state.hydrated);
  const theme = useLedger((state) => state.theme);
  const tab = useLedger((state) => state.tab);
  const setTab = useLedger((state) => state.setTab);
  const people = useLedger((state) => state.people);
  const cards = useLedger((state) => state.cards);
  const purchases = useLedger((state) => state.purchases);
  const [today, setToday] = useState<string | null>(null);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidaySource, setHolidaySource] = useState<HolidaySource | "cargando">("cargando");
  const [editor, setEditor] = useState<null | { id?: string }>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [personOpen, setPersonOpen] = useState(false);
  const [cardEditor, setCardEditor] = useState<null | { id?: string }>(null);

  useEffect(() => {
    void Promise.resolve(useLedger.persist.rehydrate()).finally(() => {
      const state = useLedger.getState();
      if (state.people.length === 0 && state.purchases.length === 0 && !state.cleared) {
        state.loadExamples();
      }
      if (!state.people.some((person) => person.isMe) && state.people.length > 0) {
        /* import paths always keep one "yo"; examples do too */
      }
      state.setHydrated(true);
      setToday(todayISO());
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    let cancel = false;
    const year = new Date().getFullYear();
    void Promise.all([loadHolidays(year), loadHolidays(year + 1)]).then((results) => {
      if (cancel) return;
      setHolidays(results.flatMap((result) => result.days));
      const rank: Record<HolidaySource, number> = { vivo: 0, cache: 1, respaldo: 2 };
      const worst = results.reduce<HolidaySource>(
        (current, result) => (rank[result.source] > rank[current] ? result.source : current),
        "vivo",
      );
      setHolidaySource(worst);
    });
    return () => {
      cancel = true;
    };
  }, [hydrated]);

  const ready = hydrated && today != null;
  const views = useMemo(
    () => (today ? purchases.map((purchase) => viewPurchase(purchase, today, holidays)) : []),
    [holidays, purchases, today],
  );
  const board = useMemo(() => dashboard(views), [views]);
  const peopleById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const me = people.find((person) => person.isMe);
  const detail = views.find((view) => view.purchase.id === detailId) ?? null;

  return (
    <div className="min-h-dvh bg-paper text-ink">
      <div className="mx-auto flex min-h-dvh max-w-6xl">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-stone px-4 py-6 md:flex">
          <p className="text-xs font-medium tracking-widest text-mist uppercase">Libreta</p>
          <p className="font-display text-3xl">Mis deudas</p>
          <p className="mt-1 text-sm text-mist">Compras a meses sin intereses</p>
          <nav className="mt-8 flex flex-col gap-1">
            {TABS.map((item) => (
              <NavButton key={item.id} item={item} active={tab === item.id} onClick={() => setTab(item.id)} />
            ))}
          </nav>
          <PressButton
            type="button"
            className="mt-auto flex h-12 items-center justify-center gap-2 rounded-2xl bg-pine font-medium text-on-pine"
            onClick={() => setEditor({})}
          >
            <Plus className="size-4" /> Nueva compra
          </PressButton>
        </aside>
        <div className="min-w-0 flex-1 pb-24 md:pb-12">
          <header className="flex items-end justify-between gap-3 px-4 pt-5 pb-3 md:px-8 md:pt-8">
            <div className="md:hidden">
              <p className="text-xs font-medium tracking-widest text-mist uppercase">Libreta</p>
              <h1 className="font-display text-4xl leading-tight">Mis deudas</h1>
            </div>
            <div className="hidden md:block">
              <h1 className="font-display text-4xl">{TABS.find((item) => item.id === tab)?.label}</h1>
              <p className="text-sm text-mist">Pagos, meses y lo que falta, en este teléfono.</p>
            </div>
            {ready && (tab === "resumen" || tab === "compras") ? (
              <PressButton
                type="button"
                className="hidden h-11 items-center gap-2 rounded-full bg-pine px-4 text-sm font-medium text-on-pine md:flex"
                onClick={() => setEditor({})}
              >
                <Plus className="size-4" /> Agregar
              </PressButton>
            ) : (
              <span className="hidden md:block" />
            )}
            {ready && (tab === "resumen" || tab === "compras") ? (
              <PressButton
                type="button"
                aria-label="Nueva compra"
                className="grid size-12 place-items-center rounded-full bg-pine text-on-pine md:hidden"
                onClick={() => setEditor({})}
              >
                <Plus className="size-5" />
              </PressButton>
            ) : null}
          </header>
          <main className="px-4 md:px-8">
            {!ready || !today ? (
              <Loading />
            ) : tab === "resumen" ? (
              <Summary
                board={board}
                meId={me?.id}
                peopleById={peopleById}
                cardsById={cardsById}
                onOpen={setDetailId}
                hasExamples={purchases.some((purchase) => purchase.example)}
                onExamples={() => setTab("ajustes")}
              />
            ) : tab === "compras" ? (
              <Purchases
                views={views}
                peopleById={peopleById}
                cardsById={cardsById}
                meId={me?.id}
                onOpen={setDetailId}
              />
            ) : tab === "personas" ? (
              <People
                views={views}
                people={people}
                onAdd={() => setPersonOpen(true)}
              />
            ) : tab === "tarjetas" ? (
              <Cards
                cards={cards}
                peopleById={peopleById}
                views={views}
                onAdd={() => setCardEditor({})}
                onEdit={(id) => setCardEditor({ id })}
              />
            ) : (
              <Settings holidaySource={holidaySource} holidayCount={holidays.length} />
            )}
          </main>
        </div>
      </div>
      <nav className="dock fixed inset-x-0 bottom-0 z-30 border-t border-stone bg-paper/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {TABS.map((item) => (
            <PressButton
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${tab === item.id ? "text-pine" : "text-mist"}`}
            >
              <item.icon className="size-5" strokeWidth={1.75} />
              {item.label}
            </PressButton>
          ))}
        </div>
      </nav>
      <Sheet open={editor != null} title={editor?.id ? "Editar compra" : "Nueva compra"} onClose={() => setEditor(null)}>
        {editor ? (
          <PurchaseForm
            key={editor.id ?? "nueva"}
            initial={purchases.find((purchase) => purchase.id === editor.id)}
            onDone={() => setEditor(null)}
          />
        ) : null}
      </Sheet>
      <Sheet open={detail != null} title={detail?.purchase.description ?? "Compra"} onClose={() => setDetailId(null)}>
        {detail && today ? (
          <PurchaseDetail
            view={detail}
            peopleById={peopleById}
            card={detail.purchase.cardId ? cardsById.get(detail.purchase.cardId) : undefined}
            onEdit={() => {
              const id = detail.purchase.id;
              setDetailId(null);
              setEditor({ id });
            }}
            onClose={() => setDetailId(null)}
          />
        ) : null}
      </Sheet>
      <Sheet open={personOpen} title="Nueva persona" onClose={() => setPersonOpen(false)}>
        {personOpen ? <PersonForm onDone={() => setPersonOpen(false)} /> : null}
      </Sheet>
      <Sheet open={cardEditor != null} title={cardEditor?.id ? "Editar tarjeta" : "Nueva tarjeta"} onClose={() => setCardEditor(null)}>
        {cardEditor ? <CardForm key={cardEditor.id ?? "nueva"} cardId={cardEditor.id} onDone={() => setCardEditor(null)} /> : null}
      </Sheet>
    </div>
  );
}

function NavButton({
  item,
  active,
  onClick,
}: {
  item: (typeof TABS)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <PressButton
      type="button"
      onClick={onClick}
      className={`flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium ${active ? "bg-pine text-on-pine" : "text-ink"}`}
    >
      <item.icon className="size-4" strokeWidth={1.75} />
      {item.label}
    </PressButton>
  );
}

function Loading() {
  return (
    <div className="rise flex flex-col gap-3 pt-2">
      <div className="h-40 rounded-3xl bg-stone/70" />
      <div className="h-24 rounded-3xl bg-surface" />
      <p className="text-sm text-mist">Abriendo tu libreta en este teléfono…</p>
    </div>
  );
}

function Summary({
  board,
  meId,
  peopleById,
  cardsById,
  onOpen,
  hasExamples,
  onExamples,
}: {
  board: ReturnType<typeof dashboard>;
  meId?: string;
  peopleById: Map<string, Person>;
  cardsById: Map<string, Card>;
  onOpen: (id: string) => void;
  hasExamples: boolean;
  onExamples: () => void;
}) {
  const plan = board.paid + board.remaining;
  const progress = plan > 0 ? (board.paid / plan) * 100 : 0;
  const mine = meId ? board.byPerson.get(meId) : undefined;
  return (
    <div className="flex flex-col gap-4">
      {hasExamples ? (
        <button type="button" onClick={onExamples} className="press rounded-2xl border border-stone bg-surface px-4 py-3 text-left text-sm text-mist">
          Hay compras de ejemplo para que veas cómo se calcula. Puedes borrarlas en Ajustes.
        </button>
      ) : null}
      <section className="rise rounded-3xl bg-pine px-5 py-5 text-on-pine">
        <p className="text-sm text-on-pine/80">Te falta por pagar</p>
        <p className="mt-1 font-display text-4xl leading-tight tabular-nums md:text-5xl">{money(board.remaining)}</p>
        {mine && Math.abs(mine.remaining - board.remaining) > 0.5 ? (
          <p className="mt-2 text-sm text-on-pine/85">Tu parte {money(mine.remaining)}</p>
        ) : null}
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-on-pine/25">
          <div className="bar-fill h-full rounded-full bg-on-pine" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Stat label="Llevas pagado" value={money(board.paid)} />
          <Stat label="Al mes" value={money(board.monthly)} />
          <Stat label="Activas" value={String(board.activeCount)} />
        </div>
      </section>
      <section>
        <h2 className="mb-2 font-display text-2xl">Por persona</h2>
        {board.byPerson.size === 0 ? (
          <Empty text="Cuando agregues una compra, aquí verás cuánto le falta a cada quien." />
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {[...board.byPerson.values()].map((row) => (
              <article key={row.personId} className="min-w-40 flex-1 rounded-2xl border border-stone bg-surface px-3 py-3">
                <p className="truncate text-sm font-medium">{peopleById.get(row.personId)?.name ?? "Persona"}</p>
                <p className="mt-1 font-display text-xl tabular-nums text-clay">{money(row.remaining)}</p>
                <p className="text-xs text-mist">falta · {money(row.monthly)} al mes</p>
              </article>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="mb-2 font-display text-2xl">Próximos cargos</h2>
        {board.upcoming.length === 0 ? (
          <Empty text="No hay pagos pendientes. Las compras liquidadas se quedan en Compras." />
        ) : (
          <div className="flex flex-col gap-2">
            {board.upcoming.slice(0, 5).map((view) => (
              <PurchaseRow
                key={view.purchase.id}
                view={view}
                peopleById={peopleById}
                cardsById={cardsById}
                onOpen={onOpen}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-on-pine/75">{label}</p>
      <p className="font-medium tabular-nums">{value}</p>
    </div>
  );
}

function Purchases({
  views,
  peopleById,
  cardsById,
  meId,
  onOpen,
}: {
  views: PurchaseView[];
  peopleById: Map<string, Person>;
  cardsById: Map<string, Card>;
  meId?: string;
  onOpen: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"activas" | "liquidadas" | "mias" | "otras">("activas");
  const filtered = views.filter((view) => {
    if (filter === "activas" && view.settled) return false;
    if (filter === "liquidadas" && !view.settled) return false;
    if (filter === "mias" && view.purchase.ownerId !== meId) return false;
    if (filter === "otras" && view.purchase.ownerId === meId) return false;
    const owner = peopleById.get(view.purchase.ownerId)?.name ?? "";
    const card = view.purchase.cardId ? cardsById.get(view.purchase.cardId) : undefined;
    const haystack = `${view.purchase.description} ${owner} ${card?.name ?? ""} ${card?.last4 ?? ""}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });
  return (
    <div className="flex flex-col gap-3">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar compra, persona o tarjeta"
        className="h-12 w-full rounded-2xl border border-stone bg-surface px-3 text-base outline-none focus:border-pine"
      />
      <div className="flex gap-2 overflow-x-auto">
        {(
          [
            ["activas", "Activas"],
            ["liquidadas", "Liquidadas"],
            ["mias", "Mías"],
            ["otras", "De otra persona"],
          ] as const
        ).map(([id, label]) => (
          <PressButton
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium ${filter === id ? "bg-pine text-on-pine" : "border border-stone bg-surface text-ink"}`}
          >
            {label}
          </PressButton>
        ))}
      </div>
      {filtered.length === 0 ? (
        <Empty text="Nada con ese filtro. Agrega una compra con el botón de abajo." />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.map((view) => (
            <PurchaseRow key={view.purchase.id} view={view} peopleById={peopleById} cardsById={cardsById} onOpen={onOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

function PurchaseRow({
  view,
  peopleById,
  cardsById,
  onOpen,
}: {
  view: PurchaseView;
  peopleById: Map<string, Person>;
  cardsById: Map<string, Card>;
  onOpen: (id: string) => void;
}) {
  const card = view.purchase.cardId ? cardsById.get(view.purchase.cardId) : undefined;
  const owner = peopleById.get(view.purchase.ownerId)?.name ?? "Sin dueño";
  const ratio = view.purchase.months > 0 ? (view.paymentNumber / view.purchase.months) * 100 : 0;
  return (
    <button
      type="button"
      onClick={() => onOpen(view.purchase.id)}
      className="press rise rounded-3xl border border-stone bg-surface px-4 py-3 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{view.purchase.description}</p>
          <p className="truncate text-sm text-mist">
            De {owner}
            {card ? ` · ${card.name} ···· ${card.last4}` : ""}
          </p>
        </div>
        <p className="shrink-0 font-display text-xl tabular-nums">
          {view.paymentNumber} <span className="text-base text-mist">de {view.purchase.months}</span>
        </p>
      </div>
      <div className="mt-3">
        <Progress value={ratio} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3 text-sm">
        <div>
          <p className="text-mist">{view.settled ? "Liquidada" : "Falta"}</p>
          <p className={`font-medium tabular-nums ${view.settled ? "text-pine" : "text-clay"}`}>
            {view.settled ? money(view.paid) : money(view.remaining)}
          </p>
        </div>
        <p className="text-right text-mist">
          {money(view.purchase.monthlyPayment)} al mes
          <br />
          {view.shares.map((share) => peopleById.get(share.personId)?.name ?? "").filter(Boolean).join(" · ")}
        </p>
      </div>
      {view.nextDue ? (
        <p className={`mt-2 text-sm ${view.holidayName || view.weekend || view.overdue ? "text-clay" : "text-mist"}`}>
          {view.overdue ? "Venció" : "Siguiente"} {formatDayShort(view.nextDue)}
          {view.holidayName ? ` · ${view.holidayName}` : view.weekend ? " · fin de semana" : ""}
          {view.chargeDate && view.chargeDate !== view.nextDue ? ` · hábil ${formatDayShort(view.chargeDate)}` : ""}
        </p>
      ) : null}
    </button>
  );
}

function PurchaseDetail({
  view,
  peopleById,
  card,
  onEdit,
  onClose,
}: {
  view: PurchaseView;
  peopleById: Map<string, Person>;
  card?: Card;
  onEdit: () => void;
  onClose: () => void;
}) {
  const setPaymentNumber = useLedger((state) => state.setPaymentNumber);
  const removePurchase = useLedger((state) => state.removePurchase);
  const [confirm, setConfirm] = useState(false);
  const purchase = view.purchase;
  const owner = peopleById.get(purchase.ownerId)?.name ?? "Sin dueño";
  const mismatch = Math.abs(view.planTotal - purchase.totalAmount) > 1;
  return (
    <div className="flex flex-col gap-4">
      <p className="font-display text-4xl tabular-nums">
        {view.paymentNumber} <span className="text-2xl text-mist">de {purchase.months}</span>
      </p>
      <p className="text-sm text-mist">
        Pagos hechos. Comprada el {formatDay(purchase.operationDate)}. Es de {owner}.
        {purchase.manualPayment == null ? " El número sigue la fecha." : " El número lo fijaste tú."}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Info label="Llevas pagado" value={money(view.paid)} />
        <Info label="Falta" value={money(view.remaining)} tone={view.settled ? "pine" : "clay"} />
        <Info label="Al mes" value={money(purchase.monthlyPayment)} />
        <Info label="Meses restantes" value={String(view.remainingMonths)} />
      </div>
      {card ? (
        <p className="rounded-2xl border border-stone bg-surface px-3 py-3 text-sm">
          {card.name} ···· {card.last4}
          <span className="text-mist"> · {peopleById.get(card.personId)?.name}</span>
        </p>
      ) : (
        <p className="text-sm text-mist">Sin tarjeta asignada.</p>
      )}
      {view.nextDue ? (
        <p className="text-sm text-ink">
          Siguiente cargo {formatDay(view.nextDue)}
          {view.chargeDate && view.chargeDate !== view.nextDue
            ? `. Cae en ${view.holidayName ?? "fin de semana"}; el día hábil siguiente es ${formatDay(view.chargeDate)}.`
            : "."}
        </p>
      ) : (
        <p className="text-sm text-pine">Esta compra ya está liquidada.</p>
      )}
      {mismatch ? (
        <p className="text-sm text-mist">
          El precio de la compra es {money(purchase.totalAmount)} y el plan (pago por meses) suma {money(view.planTotal)}. Lo que falta se calcula con el pago mensual que pusiste.
        </p>
      ) : null}
      <div>
        <h3 className="mb-2 text-sm font-medium">A cada persona le falta</h3>
        <ul className="flex flex-col gap-2">
          {view.shares.map((share) => (
            <li key={share.personId} className="flex items-center justify-between rounded-2xl bg-surface px-3 py-3 text-sm">
              <span>
                {peopleById.get(share.personId)?.name} · {formatPercent(share.percent)}%
                <span className="block text-mist">{money(share.monthly)} al mes · ya pagó {money(share.paid)}</span>
              </span>
              <span className="font-medium tabular-nums text-clay">{money(share.remaining)}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <PressButton
          type="button"
          className="h-12 rounded-2xl border border-stone bg-surface font-medium"
          onClick={() => setPaymentNumber(purchase.id, view.paymentNumber - 1)}
          disabled={view.paymentNumber <= 0}
        >
          Deshacer pago
        </PressButton>
        <PressButton
          type="button"
          className="h-12 rounded-2xl bg-pine font-medium text-on-pine"
          onClick={() => setPaymentNumber(purchase.id, view.paymentNumber + 1)}
          disabled={view.settled}
        >
          Registrar pago
        </PressButton>
      </div>
      <PressButton type="button" className="h-12 rounded-2xl border border-stone font-medium" onClick={onEdit}>
        Editar
      </PressButton>
      {confirm ? (
        <PressButton
          type="button"
          className="h-12 rounded-2xl bg-clay font-medium text-paper"
          onClick={() => {
            removePurchase(purchase.id);
            onClose();
          }}
        >
          Confirmar borrado
        </PressButton>
      ) : (
        <PressButton type="button" className="h-12 rounded-2xl text-sm font-medium text-clay" onClick={() => setConfirm(true)}>
          Borrar compra
        </PressButton>
      )}
    </div>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: "clay" | "pine" }) {
  return (
    <div className="rounded-2xl border border-stone px-3 py-3">
      <p className="text-xs text-mist">{label}</p>
      <p className={`font-medium tabular-nums ${tone === "clay" ? "text-clay" : tone === "pine" ? "text-pine" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function People({
  views,
  people,
  onAdd,
}: {
  views: PurchaseView[];
  people: Person[];
  onAdd: () => void;
}) {
  const renamePerson = useLedger((state) => state.renamePerson);
  const removePerson = useLedger((state) => state.removePerson);
  const [error, setError] = useState<string | null>(null);
  const rows = people.map((person) => {
    const owned = views.filter((view) => view.purchase.ownerId === person.id);
    const paying = views.filter((view) => view.shares.some((share) => share.personId === person.id));
    const remaining = paying.reduce((sum, view) => sum + (view.shares.find((share) => share.personId === person.id)?.remaining ?? 0), 0);
    const paid = paying.reduce((sum, view) => sum + (view.shares.find((share) => share.personId === person.id)?.paid ?? 0), 0);
    return { person, owned, paying, remaining, paid };
  });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-mist">Quién compra y quién paga pueden ser personas distintas.</p>
        <PressButton type="button" onClick={onAdd} className="h-11 shrink-0 rounded-full bg-pine px-4 text-sm font-medium text-on-pine">
          Agregar
        </PressButton>
      </div>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      {rows.map(({ person, owned, paying, remaining, paid }) => (
        <article key={person.id} className="rounded-3xl border border-stone bg-surface px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full bg-pine text-sm font-medium text-on-pine">
              {person.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <input
                className="w-full bg-transparent font-display text-2xl outline-none"
                aria-label={`Nombre de ${person.name}`}
                defaultValue={person.name}
                key={person.name}
                onBlur={(event) => {
                  const result = renamePerson(person.id, event.target.value);
                  if (result) {
                    setError(result);
                    event.target.value = person.name;
                  } else setError(null);
                }}
              />
              <p className="text-sm text-mist">{person.isMe ? "Tú" : "Otra persona"}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <p>
              <span className="block text-mist">Le falta pagar</span>
              <span className="font-medium tabular-nums text-clay">{money(remaining)}</span>
            </p>
            <p>
              <span className="block text-mist">Ya pagó</span>
              <span className="font-medium tabular-nums">{money(paid)}</span>
            </p>
          </div>
          <p className="mt-3 text-sm text-mist">
            Compras a su nombre: {owned.length === 0 ? "ninguna" : owned.map((view) => view.purchase.description).join(", ")}
          </p>
          <p className="text-sm text-mist">
            Está pagando: {paying.length === 0 ? "nada" : paying.map((view) => view.purchase.description).join(", ")}
          </p>
          {!person.isMe ? (
            <PressButton
              type="button"
              className="mt-3 text-sm font-medium text-clay"
              onClick={() => {
                const result = removePerson(person.id);
                setError(result);
              }}
            >
              Quitar persona
            </PressButton>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function Cards({
  cards,
  peopleById,
  views,
  onAdd,
  onEdit,
}: {
  cards: Card[];
  peopleById: Map<string, Person>;
  views: PurchaseView[];
  onAdd: () => void;
  onEdit: (id: string) => void;
}) {
  const removeCard = useLedger((state) => state.removeCard);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-mist">Nombre, titular y terminación. Nunca el número completo.</p>
        <PressButton type="button" onClick={onAdd} className="h-11 shrink-0 rounded-full bg-pine px-4 text-sm font-medium text-on-pine">
          Agregar
        </PressButton>
      </div>
      {error ? <p className="text-sm text-clay">{error}</p> : null}
      {cards.length === 0 ? <Empty text="Todavía no hay tarjetas." /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((card, index) => {
          const linked = views.filter((view) => view.purchase.cardId === card.id && !view.settled);
          const remaining = linked.reduce((sum, view) => sum + view.remaining, 0);
          const dark = index % 2 === 1;
          return (
            <article key={card.id} className={`rounded-3xl px-5 py-5 ${dark ? "bg-ink text-paper" : "bg-pine text-on-pine"}`}>
              <p className="text-sm opacity-80">{card.name}</p>
              <p className="mt-4 font-display text-3xl tracking-widest tabular-nums">···· {card.last4}</p>
              <p className="mt-4 text-sm">{peopleById.get(card.personId)?.name}</p>
              <p className="text-sm opacity-80">Falta en compras de esta tarjeta {money(remaining)}</p>
              <div className="mt-4 flex gap-2">
                <PressButton type="button" className="h-10 rounded-full bg-paper/15 px-4 text-sm font-medium" onClick={() => onEdit(card.id)}>
                  Editar
                </PressButton>
                <PressButton
                  type="button"
                  className="h-10 rounded-full px-4 text-sm font-medium"
                  onClick={() => setError(removeCard(card.id))}
                >
                  Borrar
                </PressButton>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Settings({
  holidaySource,
  holidayCount,
}: {
  holidaySource: HolidaySource | "cargando";
  holidayCount: number;
}) {
  const theme = useLedger((state) => state.theme);
  const setTheme = useLedger((state) => state.setTheme);
  const loadExamples = useLedger((state) => state.loadExamples);
  const removeExamples = useLedger((state) => state.removeExamples);
  const clearAll = useLedger((state) => state.clearAll);
  const importBackup = useLedger((state) => state.importBackup);
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [wipe, setWipe] = useState("");

  function download() {
    const state = useLedger.getState();
    const blob = new Blob([JSON.stringify(exportPayload(state), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "misdeudas-respaldo.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Respaldo descargado. Se queda en tus archivos, no se sube solo.");
  }

  const sourceCopy =
    holidaySource === "vivo"
      ? `Calendario de México en vivo (${holidayCount} fechas).`
      : holidaySource === "cache"
        ? "Calendario guardado en este teléfono. Se refresca cada semana."
        : holidaySource === "respaldo"
          ? "Sin conexión al calendario. Usamos fechas de respaldo de México."
          : "Consultando días festivos de México…";

  return (
    <div className="flex max-w-xl flex-col gap-4">
      <section className="rounded-3xl border border-stone bg-surface px-4 py-4">
        <h2 className="font-display text-2xl">Apariencia</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {(
            [
              ["system", "Auto"],
              ["light", "Claro"],
              ["dark", "Oscuro"],
            ] as const
          ).map(([id, label]) => (
            <PressButton
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              className={`h-11 rounded-2xl text-sm font-medium ${theme === id ? "bg-pine text-on-pine" : "border border-stone text-ink"}`}
            >
              {label}
            </PressButton>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border border-stone bg-surface px-4 py-4">
        <h2 className="font-display text-2xl">Respaldo</h2>
        <p className="mt-1 text-sm text-mist">Exporta o recupera tu libreta. El archivo no sale del teléfono hasta que tú lo compartes.</p>
        <div className="mt-3 flex gap-2">
          <PressButton type="button" onClick={download} className="h-11 flex-1 rounded-2xl bg-pine text-sm font-medium text-on-pine">
            Descargar
          </PressButton>
          <PressButton type="button" onClick={() => fileRef.current?.click()} className="h-11 flex-1 rounded-2xl border border-stone text-sm font-medium">
            Importar
          </PressButton>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              const text = await file.text();
              setMessage(importBackup(text) ?? "Libreta restaurada.");
            }}
          />
        </div>
      </section>
      <section className="rounded-3xl border border-stone bg-surface px-4 py-4">
        <h2 className="font-display text-2xl">Ejemplos</h2>
        <div className="mt-3 flex gap-2">
          <PressButton type="button" onClick={() => { loadExamples(); setMessage("Ejemplos listos."); }} className="h-11 flex-1 rounded-2xl border border-stone text-sm font-medium">
            Cargar
          </PressButton>
          <PressButton type="button" onClick={() => { removeExamples(); setMessage("Ejemplos quitados."); }} className="h-11 flex-1 rounded-2xl border border-stone text-sm font-medium">
            Quitar
          </PressButton>
        </div>
      </section>
      <section className="rounded-3xl border border-stone bg-surface px-4 py-4">
        <h2 className="flex items-center gap-2 font-display text-2xl">
          <Shield className="size-5" /> Privacidad
        </h2>
        <div className="mt-2 flex flex-col gap-2 text-sm leading-relaxed text-mist">
          <p>Tus compras, nombres y terminaciones viven solo en este teléfono. No hay cuenta ni servidor de deudas.</p>
          <p>La única conexión es el calendario público de días festivos de México. Se envía el año, nada más: ni montos, ni nombres, ni tarjetas.</p>
          <p>No pedimos el número completo de la tarjeta. Si borras los datos de este navegador, la libreta se va con ellos. Por eso existe el respaldo.</p>
          <p>{sourceCopy}</p>
        </div>
      </section>
      <section className="rounded-3xl border border-stone px-4 py-4">
        <h2 className="font-display text-2xl text-clay">Borrar todo</h2>
        <p className="mt-1 text-sm text-mist">Escribe BORRAR para vaciar la libreta de este teléfono.</p>
        <input className="mt-3 h-12 w-full rounded-2xl border border-stone bg-surface px-3 outline-none focus:border-clay" value={wipe} onChange={(event) => setWipe(event.target.value)} />
        <PressButton
          type="button"
          disabled={wipe !== "BORRAR"}
          onClick={() => {
            clearAll();
            setWipe("");
            setMessage("Libreta vacía. Sigues siendo tú, sin compras.");
          }}
          className="mt-3 h-11 w-full rounded-2xl bg-clay font-medium text-paper disabled:opacity-40"
        >
          Borrar la libreta
        </PressButton>
      </section>
      {message ? <p className="text-sm text-ink">{message}</p> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-3xl border border-dashed border-stone px-4 py-6 text-sm text-mist">{text}</p>;
}
