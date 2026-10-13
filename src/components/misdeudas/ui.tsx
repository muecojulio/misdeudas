import * as Collapsible from "@radix-ui/react-collapsible";
import * as Dialog from "@radix-ui/react-dialog";
import * as Switch from "@radix-ui/react-switch";
import { AlertCircle, Check, ChevronDown, LoaderCircle, MoreHorizontal, X } from "lucide-react";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from "react";

type PressButtonFeedback = "loading" | "success" | "error";

type PressButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  feedback?: PressButtonFeedback;
  feedbackLabel?: string;
};

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const controlId = useId();
  const labelId = useId();
  const hintId = useId();
  const isNativeControl =
    isValidElement(children) &&
    typeof children.type === "string" &&
    ["input", "select", "textarea"].includes(children.type);
  let enhancedChildren = children;

  if (isValidElement(children)) {
    const originalProps = (children as ReactElement<Record<string, unknown>>).props;
    const nextProps: Record<string, unknown> = {};
    if (hint) {
      const describedBy = [originalProps["aria-describedby"], hintId].filter(Boolean).join(" ");
      nextProps["aria-describedby"] = describedBy;
    }

    if (isNativeControl) {
      nextProps.id = originalProps.id ?? controlId;
    } else if (typeof children.type === "string" && children.type === "div") {
      nextProps.role = originalProps.role ?? "group";
      nextProps["aria-labelledby"] = [originalProps["aria-labelledby"], labelId]
        .filter(Boolean)
        .join(" ");
    } else {
      nextProps.id = originalProps.id ?? controlId;
      nextProps["aria-labelledby"] = [originalProps["aria-labelledby"], labelId]
        .filter(Boolean)
        .join(" ");
    }

    enhancedChildren = cloneElement(children as ReactElement<Record<string, unknown>>, nextProps);
  }

  return (
    <div className="field-block min-w-0">
      <label
        id={labelId}
        htmlFor={isNativeControl ? controlId : undefined}
        className="mb-1.5 block text-sm font-semibold text-ink"
      >
        {label}
      </label>
      {enhancedChildren}
      {hint ? (
        <span id={hintId} className="mt-1.5 block text-sm leading-relaxed text-mist">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export const controlClass =
  "min-h-11 w-full rounded-2xl border border-stone bg-surface px-3 text-base text-ink transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-mist/80 focus-visible:border-pine focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-pine/15 disabled:cursor-not-allowed disabled:opacity-55";

export function Toggle({
  checked,
  onCheckedChange,
  label,
  hint,
}: {
  checked: boolean;
  onCheckedChange: (value: boolean) => void;
  label: string;
  hint?: string;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-stone bg-surface px-3 py-3">
      <span className="min-w-0">
        <span id={labelId} className="block text-sm font-semibold text-ink">
          {label}
        </span>
        {hint ? (
          <span id={hintId} className="mt-0.5 block text-sm leading-relaxed text-mist">
            {hint}
          </span>
        ) : null}
      </span>
      <Switch.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="press relative h-11 w-[3.75rem] shrink-0 rounded-full border border-transparent bg-stone outline-none data-[state=checked]:bg-pine focus-visible:ring-4 focus-visible:ring-pine/20"
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
      >
        <Switch.Thumb className="absolute top-1 left-1 block size-9 rounded-full bg-surface shadow-sm transition-transform duration-200 data-[state=checked]:translate-x-4" />
      </Switch.Root>
    </div>
  );
}

export function PressButton({
  className = "",
  type = "button",
  feedback,
  feedbackLabel,
  disabled,
  ...props
}: PressButtonProps) {
  const busy = feedback === "loading";
  const stateText =
    feedbackLabel ??
    (feedback === "loading"
      ? "En curso"
      : feedback === "success"
        ? "Acción completada"
        : feedback === "error"
          ? "La acción no se completó"
          : "");

  return (
    <>
      <button
        {...props}
        type={type}
        disabled={disabled || busy}
        aria-busy={busy || props["aria-busy"] || undefined}
        data-feedback={feedback}
        className={`press min-h-11 min-w-11 touch-manipulation ${className}`}
      >
        {feedback === "loading" ? (
          <LoaderCircle className="button-feedback-icon animate-spin" aria-hidden="true" />
        ) : feedback === "success" ? (
          <Check className="button-feedback-icon" aria-hidden="true" />
        ) : feedback === "error" ? (
          <AlertCircle className="button-feedback-icon" aria-hidden="true" />
        ) : null}
        {props.children}
      </button>
      {feedback ? (
        <span className="sr-only" role="status" aria-live="polite">
          {stateText}
        </span>
      ) : null}
    </>
  );
}

export type SearchableOption = {
  value: string;
  label: string;
  description?: string;
};

export function SearchableSelect({
  id,
  options,
  value,
  onValueChange,
  placeholder = "Escribe para buscar…",
  emptyMessage = "No hay coincidencias.",
  "aria-labelledby": labelledBy,
  "aria-describedby": describedBy,
}: {
  id?: string;
  options: SearchableOption[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  emptyMessage?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-listbox`;
  const noResultsId = `${inputId}-empty`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => {
    const needle = normalizeSearch(query.trim());
    return (
      !needle || normalizeSearch(`${option.label} ${option.description ?? ""}`).includes(needle)
    );
  });
  const activeOption = activeIndex >= 0 ? filtered[activeIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    const onOutsidePointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    document.addEventListener("pointerdown", onOutsidePointer, true);
    return () => document.removeEventListener("pointerdown", onOutsidePointer, true);
    // closeMenu only uses React state setters, which remain stable between renders.
  }, [open]);

  useEffect(() => {
    if (open && activeIndex >= 0)
      optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function closeMenu() {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }

  function showMenu() {
    setOpen(true);
    setQuery("");
    const selectedIndex = options.findIndex((option) => option.value === value);
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : options.length > 0 ? 0 : -1);
  }

  function choose(option: SearchableOption) {
    onValueChange(option.value);
    closeMenu();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) {
        showMenu();
        return;
      }
      setActiveIndex((current) => (filtered.length ? (current + 1) % filtered.length : -1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        showMenu();
        return;
      }
      setActiveIndex((current) =>
        filtered.length ? (current <= 0 ? filtered.length - 1 : current - 1) : -1,
      );
    } else if (event.key === "Home" && open && filtered.length) {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === "End" && open && filtered.length) {
      event.preventDefault();
      setActiveIndex(filtered.length - 1);
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (activeOption) choose(activeOption);
    } else if (event.key === "Escape" && open) {
      event.preventDefault();
      closeMenu();
    }
  }

  return (
    <div ref={rootRef} className="search-combobox relative min-w-0">
      <div className="relative">
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={
            open && activeOption ? `${inputId}-option-${activeIndex}` : undefined
          }
          aria-labelledby={labelledBy}
          aria-describedby={
            describedBy ?? (open && filtered.length === 0 ? noResultsId : undefined)
          }
          autoComplete="off"
          value={open ? query : (selected?.label ?? "")}
          placeholder={placeholder}
          className={`${controlClass} pr-11`}
          onFocus={() => {
            if (!open) {
              setQuery("");
              setActiveIndex(options.findIndex((option) => option.value === value));
            }
          }}
          onClick={() => {
            if (!open) showMenu();
          }}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setOpen(true);
            setActiveIndex(0);
          }}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="combobox-toggle press absolute inset-y-0 right-0 grid min-h-11 min-w-11 place-items-center rounded-r-2xl text-mist"
          aria-label={open ? "Cerrar opciones" : "Abrir opciones"}
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => {
            if (open) closeMenu();
            else {
              showMenu();
              inputRef.current?.focus();
            }
          }}
        >
          <ChevronDown className="size-4" aria-hidden="true" />
        </button>
      </div>
      {open ? (
        <div className="combobox-menu absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-stone bg-surface shadow-xl">
          {filtered.length ? (
            <ul
              id={listId}
              role="listbox"
              aria-labelledby={labelledBy}
              className="max-h-60 overflow-y-auto overscroll-contain py-1"
            >
              {filtered.map((option, index) => {
                const selectedOption = option.value === value;
                const active = index === activeIndex;
                return (
                  <li
                    ref={(node) => {
                      optionRefs.current[index] = node;
                    }}
                    key={option.value}
                    id={`${inputId}-option-${index}`}
                    role="option"
                    aria-selected={selectedOption}
                    data-active={active || undefined}
                    className="combobox-option flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
                    onPointerDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(option)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{option.label}</span>
                      {option.description ? (
                        <span className="block truncate text-xs text-mist">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                    {selectedOption ? (
                      <Check className="size-4 shrink-0 text-pine" aria-hidden="true" />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p
              id={noResultsId}
              className="px-3 py-4 text-sm text-mist"
              role="status"
              aria-live="polite"
            >
              {emptyMessage}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-MX");
}

export function Disclosure({
  open,
  onOpenChange,
  label,
  children,
  className = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const contentId = useId();
  return (
    <Collapsible.Root open={open} onOpenChange={onOpenChange} className={className}>
      <Collapsible.Trigger asChild>
        <PressButton
          type="button"
          className="disclosure-trigger flex min-h-11 items-center gap-2 text-left text-sm font-semibold text-pine"
        >
          {label}
          <ChevronDown className="size-4 transition-transform duration-200" aria-hidden="true" />
        </PressButton>
      </Collapsible.Trigger>
      <Collapsible.Content
        id={contentId}
        aria-hidden={!open}
        inert={!open ? true : undefined}
        className="disclosure-content"
      >
        <div className="disclosure-content-inner">{children}</div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}

export function Progress({ value, label = "Progreso" }: { value: number; label?: string }) {
  const bounded = Math.max(0, Math.min(100, value));
  return (
    <div
      className="h-2.5 overflow-hidden rounded-full bg-stone"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(bounded)}
    >
      <div className="bar-fill h-full rounded-full bg-pine" style={{ width: `${bounded}%` }} />
    </div>
  );
}

export function HorizontalRail({
  label,
  children,
  className = "",
  innerClassName = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const railPointerRef = useRef<{ pointerId: number; x: number; y: number; moved: boolean } | null>(
    null,
  );
  const suppressRailClickRef = useRef(false);
  const [overflow, setOverflow] = useState({ left: false, right: false, any: false });

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => {
      const maxScroll = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const next = {
        left: rail.scrollLeft > 1,
        right: maxScroll - rail.scrollLeft > 1,
        any: maxScroll > 1,
      };
      setOverflow((current) =>
        current.left === next.left && current.right === next.right && current.any === next.any
          ? current
          : next,
      );
    };
    update();
    rail.addEventListener("scroll", update, { passive: true });
    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    resizeObserver?.observe(rail);
    Array.from(rail.children).forEach((child) => resizeObserver?.observe(child));
    const mutationObserver = new MutationObserver(update);
    mutationObserver.observe(rail, { childList: true, subtree: true, characterData: true });
    return () => {
      rail.removeEventListener("scroll", update);
      resizeObserver?.disconnect();
      mutationObserver.disconnect();
    };
  }, [children]);

  function onRailPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" || !event.isPrimary) return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest("input, select, textarea, [contenteditable='true']")
    )
      return;
    railPointerRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  }

  function onRailPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = railPointerRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaX = Math.abs(event.clientX - start.x);
    const deltaY = Math.abs(event.clientY - start.y);
    if (deltaX > 8 && deltaX > deltaY * 1.15) start.moved = true;
  }

  function finishRailPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const start = railPointerRef.current;
    railPointerRef.current = null;
    if (!start || start.pointerId !== event.pointerId || !start.moved) return;
    suppressRailClickRef.current = true;
    window.setTimeout(() => {
      suppressRailClickRef.current = false;
    }, 0);
  }

  function onRailClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!suppressRailClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressRailClickRef.current = false;
  }

  return (
    <div
      className={`rail-frame ${className}`}
      data-overflow-left={overflow.left || undefined}
      data-overflow-right={overflow.right || undefined}
    >
      <div
        ref={railRef}
        role="region"
        aria-label={label}
        tabIndex={overflow.any ? 0 : undefined}
        data-horizontal-scroll="true"
        className={`horizontal-rail ${innerClassName}`}
        onPointerDown={onRailPointerDown}
        onPointerMove={onRailPointerMove}
        onPointerUp={finishRailPointer}
        onPointerCancel={finishRailPointer}
        onClickCapture={onRailClickCapture}
      >
        {children}
      </div>
      {overflow.right ? (
        <span className="rail-hint" aria-hidden="true">
          Desliza
        </span>
      ) : null}
    </div>
  );
}

export function SwipeReveal({
  label,
  children,
  actions,
  className = "",
  disabled = false,
}: {
  label: string;
  children: ReactNode;
  actions: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const contentId = useId();
  const shellRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    time: number;
    initialOffset: number;
    axis: "horizontal" | "vertical" | null;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [desktop, setDesktop] = useState(false);
  const [actionWidth, setActionWidth] = useState(160);
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const showActions = !disabled && (open || desktop);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    const rail = shell?.querySelector<HTMLElement>(".swipe-actions");
    if (!rail) return;
    const measure = () => {
      const nextWidth = rail.getBoundingClientRect().width;
      if (nextWidth > 0) setActionWidth(nextWidth);
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(rail);
    return () => observer?.disconnect();
  }, [desktop]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || desktop || event.pointerType !== "touch") return;
    const target = event.target;
    if (
      target instanceof Element &&
      target.closest(
        "button, a, input, select, textarea, [role='tab'], [contenteditable='true'], [data-no-swipe]",
      )
    ) {
      return;
    }
    startRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
      initialOffset: open ? -actionWidth : 0,
      axis: null,
    };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    if (!start || event.pointerId !== start.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
      if (Math.abs(dx) > Math.abs(dy) * 1.2) {
        start.axis = "horizontal";
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {
          // Pointer capture is an enhancement; the gesture still resolves on pointerup.
        }
      } else if (Math.abs(dy) > Math.abs(dx) * 1.2) {
        start.axis = "vertical";
      }
    }
    if (start.axis === "horizontal") {
      setDragOffset(Math.min(0, Math.max(-actionWidth, start.initialOffset + dx)));
    }
  }

  function finishGesture(event: ReactPointerEvent<HTMLDivElement>) {
    const start = startRef.current;
    startRef.current = null;
    if (!start || event.pointerId !== start.pointerId || start.axis !== "horizontal") {
      setDragOffset(null);
      return;
    }
    const dx = event.clientX - start.x;
    const elapsed = Math.max(1, performance.now() - start.time);
    const velocity = dx / elapsed;
    const nextOffset = Math.min(0, Math.max(-actionWidth, start.initialOffset + dx));
    const shouldOpen = open
      ? nextOffset < -actionWidth * 0.58 && !(dx > 32 && velocity > 0.45)
      : nextOffset < -actionWidth * 0.42 || (dx < -32 && velocity < -0.45);
    setOpen(shouldOpen);
    setDragOffset(null);
    if (Math.abs(dx) > 8) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }

  function onClickCapture(event: React.MouseEvent<HTMLDivElement>) {
    if (!suppressClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    suppressClickRef.current = false;
  }

  const contentStyle = {
    transform: `translate3d(${dragOffset ?? (open && !desktop ? -actionWidth : 0)}px, 0, 0)`,
    transition: dragOffset == null ? undefined : "none",
  };

  return (
    <div
      ref={shellRef}
      className={`swipe-card-shell ${disabled ? "swipe-card-disabled" : ""} ${className}`}
      data-open={showActions || undefined}
      data-no-tab-swipe="true"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finishGesture}
      onPointerCancel={finishGesture}
      onClickCapture={onClickCapture}
    >
      {!disabled ? (
        <div
          id={contentId}
          className="swipe-actions"
          aria-hidden={!showActions}
          inert={!showActions ? true : undefined}
        >
          <div className="swipe-action-buttons">{actions}</div>
          <PressButton
            type="button"
            className="swipe-close press grid size-11 place-items-center rounded-xl"
            aria-label={`Cerrar acciones: ${label}`}
            onClick={() => setOpen(false)}
          >
            <X className="size-4" aria-hidden="true" />
          </PressButton>
        </div>
      ) : null}
      <div className="swipe-content" style={contentStyle}>
        <div className="swipe-main min-w-0">{children}</div>
        {!disabled && !desktop ? (
          <PressButton
            type="button"
            className="swipe-toggle press grid size-11 shrink-0 place-items-center rounded-full"
            aria-label={`Acciones de ${label}`}
            aria-expanded={open}
            aria-controls={contentId}
            onClick={() => setOpen((current) => !current)}
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
          </PressButton>
        ) : null}
      </div>
    </div>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-40 bg-ink/45 backdrop-blur-[2px]" />
        <Dialog.Content className="sheet-panel fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[92dvh] w-full overflow-y-auto overscroll-contain rounded-t-[2rem] border border-stone bg-paper px-4 pt-3 pb-6 shadow-2xl md:inset-y-1/2 md:bottom-auto md:max-w-lg md:-translate-y-1/2 md:rounded-[2rem] md:px-5">
          <Dialog.Description className="sr-only">
            Panel de detalles y controles de {title.toLocaleLowerCase("es-MX")}.
          </Dialog.Description>
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-stone md:hidden" />
          <div className="mb-4 flex items-center justify-between gap-3">
            <Dialog.Title className="font-display text-2xl text-ink">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <PressButton
                type="button"
                className="grid size-11 place-items-center rounded-full border border-stone text-ink"
                aria-label="Cerrar"
              >
                <X className="size-5" strokeWidth={1.75} aria-hidden="true" />
              </PressButton>
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
