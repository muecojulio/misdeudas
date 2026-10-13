import * as Tabs from "@radix-ui/react-tabs";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  CreditCard,
  LayoutDashboard,
  Plus,
  Receipt,
  Search,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { dashboard, viewPurchase, type PurchaseView } from "@/lib/misdeudas/calc";
import { formatDay, formatDayShort, todayISO } from "@/lib/misdeudas/dates";
import { parseExchangeReference, type ExchangeReference } from "@/lib/misdeudas/exchange-rates";
import { loadHolidays, type HolidaySource } from "@/lib/misdeudas/holidays";
import { formatPercent, money } from "@/lib/misdeudas/money";
import { exportPayload, useLedger } from "@/lib/misdeudas/store";
import type { Card, Holiday, Person, TabId } from "@/lib/misdeudas/types";
import { CardForm, PersonForm, PurchaseForm } from "./forms";
import { TabPanelTransition } from "./tab-panel-transition";
import { HorizontalRail, PressButton, Progress, Sheet, SwipeReveal } from "./ui";

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
  const [panelDirection, setPanelDirection] = useState<"forward" | "backward">("forward");
  const panelSwipeStart = useRef<{ x: number; y: number; time: number } | null>(null);

  useEffect(() => {
    void Promise.resolve(useLedger.persist.rehydrate()).finally(() => {
      const state = useLedger.getState();
      if (state.people.length === 0 && state.purchases.length === 0 && !state.cleared) {
        state.loadExamples();
      }
      if (!["resumen", "compras", "personas", "tarjetas", "ajustes"].includes(state.tab)) {
        state.setTab("resumen");
      }
      if (!["system", "light", "dark"].includes(state.theme)) state.setTheme("system");
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
    if (!hydrated) return;
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

  function handleTabChange(nextValue: string) {
    const nextIndex = TABS.findIndex((item) => item.id === nextValue);
    const currentIndex = TABS.findIndex((item) => item.id === tab);
    if (nextIndex < 0 || nextValue === tab) return;
    setPanelDirection(nextIndex > currentIndex ? "forward" : "backward");
    setTab(nextValue as TabId);
  }

  function onPanelPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || !event.isPrimary) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        "button, a, input, select, textarea, [role='tab'], [contenteditable='true'], [data-horizontal-scroll], [data-no-tab-swipe], [data-no-swipe]",
      )
    ) {
      return;
    }
    panelSwipeStart.current = { x: event.clientX, y: event.clientY, time: performance.now() };
  }

  function onPanelPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = panelSwipeStart.current;
    panelSwipeStart.current = null;
    if (!start || event.pointerType !== "touch") return;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const elapsed = Math.max(1, performance.now() - start.time);
    const fastEnough = Math.abs(deltaX) >= 28 && Math.abs(deltaX / elapsed) > 0.5;
    if (Math.abs(deltaX) <= Math.abs(deltaY) * 1.2 || (Math.abs(deltaX) < 56 && !fastEnough)) {
      return;
    }
    const currentIndex = TABS.findIndex((item) => item.id === tab);
    const nextIndex = currentIndex + (deltaX < 0 ? 1 : -1);
    const nextTab = TABS[nextIndex];
    if (nextTab) handleTabChange(nextTab.id);
  }

  return (
    <Tabs.Root
      value={tab}
      onValueChange={handleTabChange}
      activationMode="automatic"
      className="app-shell min-h-dvh bg-paper text-ink"
    >
      <div className="app-canvas min-h-dvh">
        <div className="mx-auto min-h-dvh max-w-6xl px-4 md:px-8">
          <header className="app-topbar">
            <div className="brand-lockup">
              <span className="brand-mark" aria-hidden="true">
                <Sparkles className="size-5" strokeWidth={1.9} />
              </span>
              <div>
                <p className="brand-kicker">LIBRETA PARA PAGOS</p>
                <p className="brand-name">Mis deudas</p>
              </div>
            </div>
            <div className="topbar-status">
              <span className="privacy-pill">
                <ShieldCheck className="size-4" aria-hidden="true" />
                <span>Privada en este dispositivo</span>
              </span>
            </div>
          </header>

          <section className="section-heading">
            <div className="min-w-0">
              <p className="section-kicker">
                {tab === "resumen" && me
                  ? `HOLA, ${me.name.toLocaleUpperCase("es-MX")}`
                  : "CUENTAS CLARAS, PASO A PASO"}
              </p>
              <h1 className="section-title font-display">
                {TABS.find((item) => item.id === tab)?.label}
              </h1>
              <p className="section-description">{tabDescription(tab)}</p>
            </div>
            {ready && (tab === "resumen" || tab === "compras") ? (
              <PressButton
                type="button"
                aria-label="Agregar compra"
                className="new-purchase-button flex shrink-0 items-center justify-center gap-2 rounded-full bg-pine px-4 font-semibold text-on-pine"
                onClick={() => setEditor({})}
              >
                <Plus className="size-5" aria-hidden="true" />
                <span className="hidden sm:inline">Agregar compra</span>
              </PressButton>
            ) : null}
          </section>

          <TabsNavigation />

          <main className="app-main">
            <Tabs.Content
              value={tab}
              className="tab-panel"
              aria-busy={!ready}
              onPointerDown={onPanelPointerDown}
              onPointerUp={onPanelPointerUp}
              onPointerCancel={() => {
                panelSwipeStart.current = null;
              }}
            >
              <TabPanelTransition tab={tab} direction={panelDirection}>
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
                    onExamples={() => handleTabChange("ajustes")}
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
                  <People views={views} people={people} onAdd={() => setPersonOpen(true)} />
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
              </TabPanelTransition>
            </Tabs.Content>
          </main>

          <footer className="app-footer">
            <span>
              <ShieldCheck className="size-4" aria-hidden="true" /> Tus compras no se suben a una
              cuenta
            </span>
            <Link to="/privacidad" className="footer-link">
              Leer privacidad <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          </footer>
        </div>
      </div>
      <Sheet
        open={editor != null}
        title={editor?.id ? "Editar compra" : "Nueva compra"}
        onClose={() => setEditor(null)}
      >
        {editor ? (
          <PurchaseForm
            key={editor.id ?? "nueva"}
            initial={purchases.find((purchase) => purchase.id === editor.id)}
            onDone={() => setEditor(null)}
          />
        ) : null}
      </Sheet>
      <Sheet
        open={detail != null}
        title={detail?.purchase.description ?? "Compra"}
        onClose={() => setDetailId(null)}
      >
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
      <Sheet
        open={cardEditor != null}
        title={cardEditor?.id ? "Editar tarjeta" : "Nueva tarjeta"}
        onClose={() => setCardEditor(null)}
      >
        {cardEditor ? (
          <CardForm
            key={cardEditor.id ?? "nueva"}
            cardId={cardEditor.id}
            onDone={() => setCardEditor(null)}
          />
        ) : null}
      </Sheet>
    </Tabs.Root>
  );
}

function tabDescription(tab: TabId): string {
  const descriptions: Record<TabId, string> = {
    resumen: "Lo importante de tus mensualidades, de un vistazo.",
    compras: "Encuentra cada compra y sigue sus pagos.",
    personas: "Reparte cada plan con quien tú quieras.",
    tarjetas: "Controla tus tarjetas sin guardar el número completo.",
    ajustes: "Apariencia, respaldo y privacidad de tu libreta.",
  };
  return descriptions[tab];
}

function TabsNavigation() {
  const activeTab = useLedger((state) => state.tab);
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [overflow, setOverflow] = useState({ left: false, right: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const update = () => {
      const active = list.querySelector<HTMLElement>("[data-state='active']");
      if (active) {
        const nextIndicator = { left: active.offsetLeft, width: active.offsetWidth };
        setIndicator((current) =>
          current.left === nextIndicator.left && current.width === nextIndicator.width
            ? current
            : nextIndicator,
        );
      }
      const maxScroll = Math.max(0, list.scrollWidth - list.clientWidth);
      const nextOverflow = { left: list.scrollLeft > 1, right: maxScroll - list.scrollLeft > 1 };
      setOverflow((current) =>
        current.left === nextOverflow.left && current.right === nextOverflow.right
          ? current
          : nextOverflow,
      );
    };
    const active = list.querySelector<HTMLElement>("[data-state='active']");
    if (active) {
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const centeredLeft = active.offsetLeft + active.offsetWidth / 2 - list.clientWidth / 2;
      list.scrollTo({
        left: Math.max(0, centeredLeft),
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }
    update();
    list.addEventListener("scroll", update, { passive: true });
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    observer?.observe(list);
    Array.from(list.children).forEach((child) => observer?.observe(child));
    return () => {
      list.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [activeTab]);

  return (
    <div className="tabs-dock-shell">
      <div
        className="tabs-frame"
        data-overflow-left={overflow.left || undefined}
        data-overflow-right={overflow.right || undefined}
      >
        <Tabs.List ref={listRef} className="app-tabs" aria-label="Secciones principales">
          <span
            className="tabs-indicator"
            aria-hidden="true"
            style={{ width: indicator.width, transform: `translateX(${indicator.left}px)` }}
          />
          {TABS.map((item) => (
            <Tabs.Trigger key={item.id} value={item.id} className="app-tab press">
              <item.icon
                className="size-[1.125rem] shrink-0"
                strokeWidth={1.8}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </Tabs.Trigger>
          ))}
        </Tabs.List>
      </div>
      {overflow.right ? (
        <span className="tabs-scroll-hint" aria-hidden="true">
          Desliza
        </span>
      ) : null}
    </div>
  );
}

function Loading() {
  return (
    <div className="loading-state rise flex flex-col gap-4 pt-2" role="status" aria-live="polite">
      <div className="loading-skeleton h-48 rounded-[2rem]" aria-hidden="true" />
      <div className="loading-skeleton h-24 rounded-3xl" aria-hidden="true" />
      <p className="text-sm font-medium text-mist">Abriendo tu libreta en este dispositivo…</p>
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
  const progress = plan > 0 ? Math.min(100, (board.paid / plan) * 100) : 0;
  const mine = meId ? board.byPerson.get(meId) : undefined;
  return (
    <div className="summary-layout">
      {hasExamples ? (
        <PressButton type="button" onClick={onExamples} className="example-callout">
          <span className="example-stamp">
            <Sparkles className="size-4" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-left">
            <span className="block font-semibold text-ink">Estás viendo datos de muestra</span>
            <span className="block text-sm text-mist">
              Puedes quitarlos desde Ajustes cuando quieras.
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-pine" aria-hidden="true" />
        </PressButton>
      ) : null}

      <section className="summary-hero rise" aria-labelledby="summary-balance-title">
        <div className="summary-hero-decoration" aria-hidden="true" />
        <div className="summary-hero-topline">
          <span className="hero-eyebrow">
            <Sparkles className="size-4" aria-hidden="true" /> TU PLAN, MÁS CLARO
          </span>
          <span className="hero-tag">
            {board.activeCount} {board.activeCount === 1 ? "plan activo" : "planes activos"}
          </span>
        </div>
        <div className="summary-hero-main">
          <div className="min-w-0">
            <p id="summary-balance-title" className="hero-secondary text-sm font-medium">
              Te falta por pagar
            </p>
            <p className="summary-balance tabular-nums">{money(board.remaining)}</p>
            {mine && Math.abs(mine.remaining - board.remaining) > 0.5 ? (
              <p className="hero-secondary mt-1 text-sm">Tu parte: {money(mine.remaining)}</p>
            ) : null}
          </div>
          <div
            className="paid-orbit"
            role="img"
            aria-label={`${Math.round(progress)} por ciento del plan está pagado`}
            style={{
              background: `conic-gradient(var(--color-lime) ${progress}%, rgba(255,255,255,.20) 0)`,
            }}
          >
            <span className="paid-orbit-inner">
              <strong>{Math.round(progress)}%</strong>
              <small>pagado</small>
            </span>
          </div>
        </div>
        <div className="summary-progress-wrap">
          <Progress value={progress} label="Porcentaje pagado del plan" />
          <div className="summary-progress-caption">
            <span>{money(board.paid)} pagados</span>
            <span>de {money(plan)}</span>
          </div>
        </div>
        <span className="hero-doodle" aria-hidden="true">
          ↗
        </span>
      </section>

      <div className="summary-stats-grid" aria-label="Resumen de tus pagos">
        <article className="summary-stat stat-lime">
          <span className="stat-icon">
            <Check className="size-4" aria-hidden="true" />
          </span>
          <span>
            <span className="stat-label">Llevas pagado</span>
            <strong>{money(board.paid)}</strong>
          </span>
        </article>
        <article className="summary-stat stat-apricot">
          <span className="stat-icon">
            <CalendarDays className="size-4" aria-hidden="true" />
          </span>
          <span>
            <span className="stat-label">Cada mes</span>
            <strong>{money(board.monthly)}</strong>
          </span>
        </article>
        <article className="summary-stat stat-lilac">
          <span className="stat-icon">
            <Receipt className="size-4" aria-hidden="true" />
          </span>
          <span>
            <span className="stat-label">Por terminar</span>
            <strong>
              {board.activeCount} {board.activeCount === 1 ? "compra" : "compras"}
            </strong>
          </span>
        </article>
      </div>

      <section className="dashboard-section">
        <SectionTitle icon={Users} title="Por persona" detail="Así va el reparto" />
        {board.byPerson.size === 0 ? (
          <Empty text="Cuando agregues una compra, aquí verás cuánto le falta a cada quien." />
        ) : (
          <HorizontalRail
            label="Resumen de pagos por persona"
            className="people-summary-rail"
            innerClassName="people-summary-track"
          >
            {[...board.byPerson.values()].map((row, index) => (
              <article key={row.personId} className={`person-total-card person-total-${index % 3}`}>
                <div className="person-total-avatar" aria-hidden="true">
                  {(peopleById.get(row.personId)?.name ?? "P").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {peopleById.get(row.personId)?.name ?? "Persona"}
                  </p>
                  <p className="mt-2 font-display text-2xl tabular-nums">{money(row.remaining)}</p>
                  <p className="text-xs text-mist">pendiente · {money(row.monthly)} al mes</p>
                </div>
              </article>
            ))}
          </HorizontalRail>
        )}
      </section>

      <section className="dashboard-section">
        <SectionTitle icon={CalendarDays} title="Próximos cargos" detail="Lo que viene" />
        {board.upcoming.length === 0 ? (
          <Empty text="No hay pagos pendientes. Las compras liquidadas se quedan en Compras." />
        ) : (
          <HorizontalRail
            label="Próximos cargos"
            className="upcoming-rail"
            innerClassName="upcoming-track"
          >
            {board.upcoming.slice(0, 5).map((view) => (
              <div className="upcoming-item" key={view.purchase.id}>
                <PurchaseRow
                  view={view}
                  peopleById={peopleById}
                  cardsById={cardsById}
                  onOpen={onOpen}
                  actionsEnabled={false}
                />
              </div>
            ))}
          </HorizontalRail>
        )}
      </section>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof Users;
  title: string;
  detail: string;
}) {
  return (
    <div className="section-title-row">
      <span className="section-title-icon">
        <Icon className="size-[1.125rem]" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-2xl leading-tight">{title}</h2>
        <p className="text-sm text-mist">{detail}</p>
      </div>
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
    const haystack = normalizeText(
      `${view.purchase.description} ${owner} ${card?.name ?? ""} ${card?.last4 ?? ""}`,
    );
    return haystack.includes(normalizeText(query.trim()));
  });
  const filters = [
    ["activas", "Activas"],
    ["liquidadas", "Liquidadas"],
    ["mias", "Mías"],
    ["otras", "De otra persona"],
  ] as const;

  return (
    <div className="purchases-layout">
      <div className="purchase-search">
        <Search className="size-5 shrink-0 text-pine" aria-hidden="true" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar compra, persona o tarjeta"
          aria-label="Buscar compra, persona o tarjeta"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-mist/80"
        />
        {query ? (
          <PressButton
            type="button"
            className="grid size-11 place-items-center rounded-full text-mist"
            aria-label="Limpiar búsqueda"
            onClick={() => setQuery("")}
          >
            <span aria-hidden="true">×</span>
          </PressButton>
        ) : null}
      </div>

      <HorizontalRail
        label="Filtros de compras"
        className="filter-rail"
        innerClassName="filter-list"
      >
        {filters.map(([id, label]) => (
          <PressButton
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => setFilter(id)}
            className={`filter-chip ${filter === id ? "chip-active" : "chip-idle"}`}
          >
            {filter === id ? <Check className="size-4" aria-hidden="true" /> : null}
            {label}
          </PressButton>
        ))}
      </HorizontalRail>
      <p className="results-caption" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "compra" : "compras"}{" "}
        {query ? "encontradas" : "en la libreta"}
      </p>

      {filtered.length === 0 ? (
        <Empty text="Nada con ese filtro. Prueba otra búsqueda o agrega una compra nueva." />
      ) : (
        <div className="purchase-list-stack" role="region" aria-label="Compras encontradas">
          {filtered.map((view) => (
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
    </div>
  );
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

function PurchaseRow({
  view,
  peopleById,
  cardsById,
  onOpen,
  actionsEnabled = true,
}: {
  view: PurchaseView;
  peopleById: Map<string, Person>;
  cardsById: Map<string, Card>;
  onOpen: (id: string) => void;
  actionsEnabled?: boolean;
}) {
  const card = view.purchase.cardId ? cardsById.get(view.purchase.cardId) : undefined;
  const owner = peopleById.get(view.purchase.ownerId)?.name ?? "Sin dueño";
  const ratio = view.purchase.months > 0 ? (view.paymentNumber / view.purchase.months) * 100 : 0;
  const setPaymentNumber = useLedger((state) => state.setPaymentNumber);
  const [registered, setRegistered] = useState(false);
  const purchase = view.purchase;

  useEffect(() => {
    if (!registered) return;
    const timer = window.setTimeout(() => setRegistered(false), 1600);
    return () => window.clearTimeout(timer);
  }, [registered]);

  return (
    <SwipeReveal
      label={`${purchase.description}, pago ${view.paymentNumber} de ${purchase.months}`}
      className="purchase-swipe"
      disabled={!actionsEnabled}
      actions={
        <>
          <PressButton
            type="button"
            className="swipe-action-button"
            disabled={view.settled || registered}
            feedback={registered ? "success" : undefined}
            feedbackLabel="Pago registrado"
            onClick={() => {
              setPaymentNumber(purchase.id, view.paymentNumber + 1);
              setRegistered(true);
            }}
          >
            Registrar pago
          </PressButton>
          <PressButton
            type="button"
            className="swipe-action-button"
            onClick={() => onOpen(purchase.id)}
          >
            Ver detalle
          </PressButton>
        </>
      }
    >
      <article className={`purchase-card ${view.settled ? "purchase-card-settled" : ""}`}>
        <div className="purchase-card-top">
          <span className="purchase-category-mark" aria-hidden="true">
            <Receipt className="size-[1.125rem]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{purchase.description}</p>
            <p className="truncate text-sm text-mist">
              De {owner}
              {card ? ` · ${card.name} ···· ${card.last4}` : ""}
            </p>
          </div>
          <span
            className="purchase-payment tabular-nums"
            aria-label={`Pago ${view.paymentNumber} de ${purchase.months}`}
          >
            <strong>{view.paymentNumber}</strong>
            <small>/{purchase.months}</small>
          </span>
        </div>
        <div className="purchase-card-progress">
          <Progress value={ratio} label={`Pagos realizados en ${purchase.description}`} />
        </div>
        <div className="purchase-card-bottom">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-mist">
              {view.settled ? "Total pagado" : "Pendiente"}
            </p>
            <p
              className={`mt-0.5 font-display text-xl tabular-nums ${view.settled ? "text-pine" : "text-clay"}`}
            >
              {view.settled ? money(view.paid) : money(view.remaining)}
            </p>
          </div>
          <div className="purchase-card-actions">
            <p className="text-right text-sm font-semibold tabular-nums">
              {money(purchase.monthlyPayment)} <span className="font-normal text-mist">al mes</span>
            </p>
            <PressButton
              type="button"
              onClick={() => onOpen(purchase.id)}
              className="purchase-details-link"
              aria-label={`Ver detalles de ${purchase.description}`}
            >
              Ver detalles <ArrowRight className="size-3.5" aria-hidden="true" />
            </PressButton>
          </div>
        </div>
        {view.nextDue ? (
          <p
            className={`purchase-due ${view.overdue || view.holidayName || view.weekend ? "purchase-due-alert" : ""}`}
          >
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            {view.overdue ? "Venció" : "Siguiente cargo"} {formatDayShort(view.nextDue)}
            {view.holidayName ? ` · ${view.holidayName}` : view.weekend ? " · fin de semana" : ""}
            {view.chargeDate && view.chargeDate !== view.nextDue
              ? ` · hábil ${formatDayShort(view.chargeDate)}`
              : ""}
          </p>
        ) : (
          <p className="purchase-due purchase-due-paid">
            <Check className="size-4" aria-hidden="true" /> Compra liquidada
          </p>
        )}
      </article>
    </SwipeReveal>
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
        {purchase.manualPayment == null
          ? " El número sigue la fecha."
          : " El número lo fijaste tú."}
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
          El precio de la compra es {money(purchase.totalAmount)} y el plan (pago por meses) suma{" "}
          {money(view.planTotal)}. Lo que falta se calcula con el pago mensual que pusiste.
        </p>
      ) : null}
      <div>
        <h3 className="mb-2 text-sm font-medium">A cada persona le falta</h3>
        <ul className="flex flex-col gap-2">
          {view.shares.map((share) => (
            <li
              key={share.personId}
              className="flex items-center justify-between rounded-2xl bg-surface px-3 py-3 text-sm"
            >
              <span>
                {peopleById.get(share.personId)?.name} · {formatPercent(share.percent)}%
                <span className="block text-mist">
                  {money(share.monthly)} al mes · ya pagó {money(share.paid)}
                </span>
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
      <PressButton
        type="button"
        className="h-12 rounded-2xl border border-stone font-medium"
        onClick={onEdit}
      >
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
        <PressButton
          type="button"
          className="h-12 rounded-2xl text-sm font-medium text-clay"
          onClick={() => setConfirm(true)}
        >
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
      <p
        className={`font-medium tabular-nums ${tone === "clay" ? "text-clay" : tone === "pine" ? "text-pine" : "text-ink"}`}
      >
        {value}
      </p>
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
    const paying = views.filter((view) =>
      view.shares.some((share) => share.personId === person.id),
    );
    const remaining = paying.reduce(
      (sum, view) =>
        sum + (view.shares.find((share) => share.personId === person.id)?.remaining ?? 0),
      0,
    );
    const paid = paying.reduce(
      (sum, view) => sum + (view.shares.find((share) => share.personId === person.id)?.paid ?? 0),
      0,
    );
    return { person, owned, paying, remaining, paid };
  });
  return (
    <div className="people-layout">
      <div className="people-intro flex items-center justify-between gap-3">
        <p className="text-sm text-mist">
          Quién compra y quién paga pueden ser personas distintas.
        </p>
        <PressButton
          type="button"
          onClick={onAdd}
          className="h-11 shrink-0 rounded-full bg-pine px-4 text-sm font-medium text-on-pine"
        >
          Agregar
        </PressButton>
      </div>
      {error ? (
        <p className="text-sm text-clay" role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <Empty text="Agrega una persona para organizar los pagos compartidos." />
      ) : (
        <HorizontalRail
          label="Personas de la libreta"
          className="people-directory-rail"
          innerClassName="people-directory-grid"
        >
          {rows.map(({ person, owned, paying, remaining, paid }, index) => (
            <article
              key={person.id}
              className={`person-directory-card person-directory-${index % 3}`}
            >
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-pine text-sm font-medium text-on-pine">
                  {person.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <input
                    className="w-full rounded-lg bg-transparent font-display text-2xl outline-none focus-visible:ring-4 focus-visible:ring-pine/20"
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
                Compras a su nombre:{" "}
                {owned.length === 0
                  ? "ninguna"
                  : owned.map((view) => view.purchase.description).join(", ")}
              </p>
              <p className="text-sm text-mist">
                Está pagando:{" "}
                {paying.length === 0
                  ? "nada"
                  : paying.map((view) => view.purchase.description).join(", ")}
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
        </HorizontalRail>
      )}
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
    <div className="cards-layout">
      <div className="cards-intro flex items-center justify-between gap-3">
        <p className="text-sm text-mist">
          Nombre, titular y terminación. Nunca el número completo.
        </p>
        <PressButton
          type="button"
          onClick={onAdd}
          className="h-11 shrink-0 rounded-full bg-pine px-4 text-sm font-semibold text-on-pine"
        >
          <Plus className="mr-1 size-4" aria-hidden="true" /> Agregar
        </PressButton>
      </div>
      {error ? (
        <p className="text-sm text-clay" role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}
      {cards.length === 0 ? (
        <Empty text="Todavía no hay tarjetas. Agrega una para asociarla a tus compras." />
      ) : (
        <HorizontalRail
          label="Tarjetas guardadas"
          className="cards-rail"
          innerClassName="cards-grid"
        >
          {cards.map((card, index) => {
            const linked = views.filter(
              (view) => view.purchase.cardId === card.id && !view.settled,
            );
            const remaining = linked.reduce((sum, view) => sum + view.remaining, 0);
            const dark = index % 2 === 1;
            return (
              <article
                key={card.id}
                className={`payment-card ${dark ? "payment-card-ink" : "payment-card-pine"}`}
              >
                <div className="payment-card-shine" aria-hidden="true" />
                <div className="payment-card-head">
                  <p className="truncate font-semibold">{card.name}</p>
                  <CreditCard className="size-5 opacity-80" aria-hidden="true" />
                </div>
                <p className="payment-card-number tabular-nums">···· {card.last4}</p>
                <div className="payment-card-details">
                  <span className="min-w-0">
                    <small>TITULAR</small>
                    <strong className="truncate">
                      {peopleById.get(card.personId)?.name ?? "Sin titular"}
                    </strong>
                  </span>
                  <span className="text-right">
                    <small>PENDIENTE</small>
                    <strong className="tabular-nums">{money(remaining)}</strong>
                  </span>
                </div>
                <div className="payment-card-actions">
                  <PressButton
                    type="button"
                    className="payment-card-action"
                    onClick={() => onEdit(card.id)}
                  >
                    Editar
                  </PressButton>
                  <PressButton
                    type="button"
                    className="payment-card-action payment-card-action-delete"
                    onClick={() => setError(removeCard(card.id))}
                  >
                    Borrar
                  </PressButton>
                </div>
              </article>
            );
          })}
        </HorizontalRail>
      )}
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
    const blob = new Blob([JSON.stringify(exportPayload(state), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "misdeudas-respaldo.json";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(
      "Respaldo descargado. El archivo es una copia sin cifrar; guárdalo en un lugar privado.",
    );
  }

  const sourceCopy =
    holidaySource === "vivo"
      ? `Calendario público de México actualizado (${holidayCount} fechas).`
      : holidaySource === "cache"
        ? "Calendario guardado en este dispositivo. Se renueva cada semana."
        : holidaySource === "respaldo"
          ? "El calendario está sin conexión; usamos fechas de respaldo de México."
          : "Consultando el calendario público de México…";

  return (
    <div className="settings-layout">
      <section className="settings-card settings-card-highlight">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-lime">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl">Apariencia</h2>
            <p className="text-sm text-mist">Que se sienta como tu libreta.</p>
          </div>
        </div>
        <div
          className="mt-4 grid grid-cols-3 gap-2"
          role="group"
          aria-label="Tema de la aplicación"
        >
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
              aria-pressed={theme === id}
              onClick={() => setTheme(id)}
              className={`theme-choice ${theme === id ? "theme-choice-active" : "theme-choice-idle"}`}
            >
              {theme === id ? <Check className="size-4" aria-hidden="true" /> : null}
              {label}
            </PressButton>
          ))}
        </div>
        <p className="mt-3 text-xs text-mist">
          Las animaciones se reducen automáticamente si tu dispositivo lo solicita.
        </p>
      </section>

      <ExchangeRateCard />

      <section className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-apricot">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl">Tu información</h2>
            <p className="text-sm text-mist">Privada y guardada localmente.</p>
          </div>
        </div>
        <div className="privacy-summary-copy">
          <p>
            Tus compras, personas y tarjetas se guardan en el almacenamiento de este navegador; no
            existe una cuenta ni una base de datos de compras en la aplicación.
          </p>
          <p>
            El calendario público recibe solo el año. El tipo de cambio se consulta cuando tú lo
            pides y solo comparte códigos de moneda.
          </p>
          <p>{sourceCopy}</p>
        </div>
        <Link to="/privacidad" className="settings-link">
          Leer la política de privacidad <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-sky">
            <ArrowRight className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl">Respaldo</h2>
            <p className="text-sm text-mist">Llévate tu libreta o restáurala.</p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          La copia JSON incluye nombres, movimientos y terminaciones de tarjeta. No se sube a ningún
          servidor, pero no está cifrada.
        </p>
        <div className="mt-3 flex gap-2">
          <PressButton type="button" onClick={download} className="settings-primary-button flex-1">
            Descargar copia
          </PressButton>
          <PressButton
            type="button"
            onClick={() => fileRef.current?.click()}
            className="settings-secondary-button flex-1"
          >
            Importar copia
          </PressButton>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Seleccionar copia de seguridad JSON"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;
              if (file.size > 1_000_000) {
                setMessage("El archivo supera el límite de 1 MB.");
                return;
              }
              try {
                const text = await file.text();
                setMessage(importBackup(text) ?? "Libreta restaurada correctamente.");
              } catch {
                setMessage("No se pudo leer el archivo. Intenta con otra copia JSON.");
              }
            }}
          />
        </div>
      </section>

      <section className="settings-card">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-lilac">
            <Receipt className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl">Datos de ejemplo</h2>
            <p className="text-sm text-mist">Prueba los cálculos sin comprometer tu información.</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <PressButton
            type="button"
            onClick={() => {
              loadExamples();
              setMessage("Datos de ejemplo listos.");
            }}
            className="settings-secondary-button flex-1"
          >
            Cargar ejemplos
          </PressButton>
          <PressButton
            type="button"
            onClick={() => {
              removeExamples();
              setMessage("Datos de ejemplo quitados.");
            }}
            className="settings-secondary-button flex-1"
          >
            Quitar ejemplos
          </PressButton>
        </div>
      </section>

      <section className="settings-card settings-danger-card">
        <div className="settings-card-heading">
          <span className="settings-icon settings-icon-coral">
            <Shield className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-2xl text-clay">Borrar tu libreta</h2>
            <p className="text-sm text-mist">
              Elimina personas, compras y tarjetas de este navegador.
            </p>
          </div>
        </div>
        <label htmlFor="wipe-confirm" className="mt-4 block text-sm font-semibold">
          Escribe BORRAR para confirmar
        </label>
        <input
          id="wipe-confirm"
          className="mt-2 min-h-11 w-full rounded-2xl border border-stone bg-surface px-3 outline-none transition focus-visible:border-clay focus-visible:ring-4 focus-visible:ring-clay/15"
          autoComplete="off"
          value={wipe}
          onChange={(event) => setWipe(event.target.value)}
        />
        <PressButton
          type="button"
          disabled={wipe !== "BORRAR"}
          onClick={() => {
            clearAll();
            setWipe("");
            setMessage("Libreta vacía. El cambio solo afecta a este dispositivo.");
          }}
          className="settings-danger-button mt-3 w-full"
        >
          Borrar la libreta
        </PressButton>
      </section>
      {message ? (
        <p className="settings-feedback" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function ExchangeRateCard() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [reference, setReference] = useState<ExchangeReference | null>(null);
  const [amount, setAmount] = useState("1000");

  async function refresh() {
    setStatus("loading");
    try {
      const response = await fetch("/api/exchange-rates?base=MXN&symbols=USD,EUR", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("rate");
      const parsed = parseExchangeReference(await response.json());
      if (!parsed) throw new Error("rate");
      setReference(parsed);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  const pesos = Number(amount);
  const converted = (currency: "USD" | "EUR") =>
    reference && Number.isFinite(pesos) && pesos >= 0
      ? new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency,
          maximumFractionDigits: 2,
        }).format(pesos * reference.rates[currency])
      : "—";

  return (
    <section className="settings-card exchange-card">
      <div className="settings-card-heading">
        <span className="settings-icon settings-icon-sky">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-display text-2xl">Cambio de moneda</h2>
          <p className="text-sm text-mist">Una referencia pública para compras en otro país.</p>
        </div>
      </div>
      <div className="exchange-controls">
        <label htmlFor="exchange-amount" className="text-sm font-semibold">
          Monto en pesos
        </label>
        <input
          id="exchange-amount"
          className="min-h-11 w-full rounded-2xl border border-stone bg-surface px-3 tabular-nums outline-none focus-visible:border-pine focus-visible:ring-4 focus-visible:ring-pine/15"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <PressButton
          type="button"
          onClick={refresh}
          feedback={status === "idle" ? undefined : status}
          feedbackLabel={
            status === "loading"
              ? "Consultando el servicio público"
              : status === "success"
                ? "Tipo de cambio actualizado"
                : "No se pudo consultar el tipo de cambio"
          }
          className="settings-primary-button"
        >
          {status === "loading"
            ? "Consultando…"
            : status === "success"
              ? "Actualizar referencia"
              : "Consultar tipo de cambio"}
        </PressButton>
      </div>
      {reference ? (
        <div className="exchange-results" aria-live="polite">
          <p className="text-sm font-semibold">
            {converted("USD")} <span>USD</span>
          </p>
          <p className="text-sm font-semibold">
            {converted("EUR")} <span>EUR</span>
          </p>
          <p className="exchange-date">
            Referencia del{" "}
            {new Date(`${reference.date}T12:00:00`).toLocaleDateString("es-MX", {
              dateStyle: "long",
            })}
          </p>
        </div>
      ) : null}
      {status === "error" ? (
        <p className="exchange-error" role="alert" aria-live="assertive">
          No se pudo consultar la fuente pública. Puedes intentarlo más tarde; tus compras no
          cambian.
        </p>
      ) : null}
      <p className="mt-3 text-xs leading-relaxed text-mist">
        Cotización de referencia de Frankfurter (sin clave ni registro). La conversión se calcula
        aquí; no se envía el monto. No incluye tipo de cambio, comisiones ni condiciones de tu
        banco.
      </p>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="empty-state px-4 py-6 text-sm leading-relaxed">{text}</p>;
}
