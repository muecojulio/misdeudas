import { useMemo, useState } from "react";
import { paymentsFromDate } from "@/lib/misdeudas/calc";
import { isISODate, todayISO } from "@/lib/misdeudas/dates";
import { cents, equalPercents, formatPercent, money } from "@/lib/misdeudas/money";
import { useLedger, type PurchaseInput } from "@/lib/misdeudas/store";
import type { Purchase } from "@/lib/misdeudas/types";
import {
  Disclosure,
  Field,
  HorizontalRail,
  PressButton,
  SearchableSelect,
  Toggle,
  controlClass,
} from "./ui";

const MONTH_CHIPS = [3, 6, 9, 12, 18, 24];

export function PurchaseForm({ initial, onDone }: { initial?: Purchase; onDone: () => void }) {
  const people = useLedger((state) => state.people);
  const cards = useLedger((state) => state.cards);
  const savePurchase = useLedger((state) => state.savePurchase);
  const addPerson = useLedger((state) => state.addPerson);
  const addCard = useLedger((state) => state.addCard);
  const me = people.find((person) => person.isMe) ?? people[0];

  const [description, setDescription] = useState(initial?.description ?? "");
  const [operationDate, setOperationDate] = useState(initial?.operationDate ?? todayISO());
  const [months, setMonths] = useState(initial?.months ?? 12);
  const [total, setTotal] = useState(initial ? String(initial.totalAmount) : "");
  const [monthly, setMonthly] = useState(initial ? String(initial.monthlyPayment) : "");
  const [monthlyTouched, setMonthlyTouched] = useState(Boolean(initial));
  const [autoDate, setAutoDate] = useState(initial ? initial.manualPayment == null : true);
  const [paymentNumber, setPaymentNumber] = useState(initial?.manualPayment ?? 1);
  const [ownerId, setOwnerId] = useState(initial?.ownerId ?? me?.id ?? "");
  const [cardId, setCardId] = useState(initial?.cardId ?? "");
  const [equal, setEqual] = useState(() => {
    if (!initial || initial.shares.length <= 1) return true;
    const first = initial.shares[0]?.percent ?? 0;
    return initial.shares.every((share) => Math.abs(share.percent - first) < 0.2);
  });
  const [shareIds, setShareIds] = useState<string[]>(
    initial?.shares.map((share) => share.personId) ?? (me ? [me.id] : []),
  );
  const [custom, setCustom] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const share of initial?.shares ?? []) map[share.personId] = String(share.percent);
    return map;
  });
  const [personName, setPersonName] = useState("");
  const [cardDraft, setCardDraft] = useState({ name: "", last4: "", personId: me?.id ?? "" });
  const [showPerson, setShowPerson] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const percents = useMemo(() => {
    if (shareIds.length === 0) return [];
    if (equal) return equalPercents(shareIds.length);
    return shareIds.map((id) => Number(custom[id] || 0));
  }, [custom, equal, shareIds]);

  function onTotal(value: string) {
    setTotal(value);
    if (!monthlyTouched) {
      const amount = Number(value);
      if (amount > 0 && months > 0) setMonthly(String(cents(amount / months)));
    }
  }

  function onMonths(value: number) {
    setMonths(value);
    setPaymentNumber((current) => Math.min(current, value));
    if (!monthlyTouched) {
      const amount = Number(total);
      if (amount > 0) setMonthly(String(cents(amount / value)));
    }
  }

  function toggleShare(id: string) {
    setShareIds((current) => {
      if (current.includes(id)) {
        if (current.length === 1) return current;
        return current.filter((item) => item !== id);
      }
      return [...current, id];
    });
  }

  function submit() {
    if (!me) return;
    const shares = shareIds.map((personId, index) => ({
      personId,
      percent: percents[index] ?? 0,
    }));
    const input: PurchaseInput = {
      description,
      operationDate,
      months,
      totalAmount: Number(total),
      monthlyPayment: Number(monthly),
      manualPayment: autoDate ? null : paymentNumber,
      ownerId,
      cardId: cardId || null,
      shares,
    };
    const result = savePurchase(input, initial?.id);
    if (result) {
      setError(result);
      return;
    }
    onDone();
  }

  const monthlyNumber = Number(monthly);
  const counted = autoDate
    ? isISODate(operationDate)
      ? paymentsFromDate(operationDate, months, todayISO())
      : 0
    : paymentNumber;
  const previewRemaining =
    Number.isFinite(monthlyNumber) && monthlyNumber > 0 ? monthlyNumber * (months - counted) : 0;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Field label="Descripción">
        <input
          className={controlClass}
          value={description}
          maxLength={120}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Refrigerador, pantalla, viaje…"
        />
      </Field>
      <Field label="Fecha de operación">
        <input
          className={controlClass}
          type="date"
          value={operationDate}
          onChange={(event) => setOperationDate(event.target.value)}
        />
      </Field>
      <Field
        label="De quién es la compra"
        hint="Puede ser tuya o de otra persona, aunque el pago lo hagas tú."
      >
        <SearchableSelect
          options={people.map((person) => ({ value: person.id, label: person.name }))}
          value={ownerId}
          onValueChange={setOwnerId}
          placeholder="Buscar persona…"
        />
      </Field>
      <Field label="Meses">
        <div className="flex flex-col gap-2">
          <HorizontalRail
            label="Duración en meses"
            className="month-chip-rail"
            innerClassName="month-chip-list"
          >
            {MONTH_CHIPS.map((chip) => (
              <PressButton
                key={chip}
                type="button"
                aria-pressed={months === chip}
                onClick={() => onMonths(chip)}
                className={`shrink-0 rounded-full px-4 text-sm font-semibold ${months === chip ? "chip-active" : "chip-idle"}`}
              >
                {chip} meses
              </PressButton>
            ))}
          </HorizontalRail>
          <input
            className={`${controlClass} tabular-nums`}
            inputMode="numeric"
            aria-label="Duración personalizada en meses"
            value={String(months)}
            onChange={(event) =>
              onMonths(
                Math.max(1, Math.min(48, Number(event.target.value.replace(/\D/g, "")) || 1)),
              )
            }
          />
        </div>
      </Field>
      <Toggle
        checked={autoDate}
        onCheckedChange={setAutoDate}
        label="Calcular el número de pago con la fecha"
        hint="Cuenta un pago cada mes desde la compra. Apágalo si quieres escribir 1 de 10 tú mismo."
      />
      {!autoDate ? (
        <Field
          label="Número de pago"
          hint={`${paymentNumber} de ${months} cuenta ese pago como ya realizado.`}
        >
          <div className="flex items-center gap-3">
            <PressButton
              type="button"
              className="grid size-12 place-items-center rounded-2xl border border-stone bg-surface text-xl"
              onClick={() => setPaymentNumber((value) => Math.max(0, value - 1))}
              aria-label="Un pago menos"
            >
              −
            </PressButton>
            <p className="flex-1 text-center font-display text-3xl tabular-nums text-ink">
              {paymentNumber} <span className="text-mist">de</span> {months}
            </p>
            <PressButton
              type="button"
              className="grid size-12 place-items-center rounded-2xl border border-stone bg-surface text-xl"
              onClick={() => setPaymentNumber((value) => Math.min(months, value + 1))}
              aria-label="Un pago más"
            >
              +
            </PressButton>
          </div>
        </Field>
      ) : null}
      <Field label="Monto de la compra">
        <input
          className={`${controlClass} tabular-nums`}
          inputMode="decimal"
          value={total}
          onChange={(event) => onTotal(event.target.value.replace(/[^\d.]/g, ""))}
          placeholder="0.00"
        />
      </Field>
      <Field
        label="Cuánto pagas al mes"
        hint="Se sugiere el total entre los meses. Cámbialo si el banco te cobra otra cantidad."
      >
        <input
          className={`${controlClass} tabular-nums`}
          inputMode="decimal"
          value={monthly}
          onChange={(event) => {
            setMonthlyTouched(true);
            setMonthly(event.target.value.replace(/[^\d.]/g, ""));
          }}
          placeholder="0.00"
        />
      </Field>
      <Field label="Tarjeta" hint="Solo guardamos el nombre y los últimos 4 números.">
        <SearchableSelect
          options={[
            { value: "", label: "Sin tarjeta" },
            ...cards.map((card) => ({
              value: card.id,
              label: `${card.name} ···· ${card.last4}`,
              description: people.find((person) => person.id === card.personId)?.name ?? "",
            })),
          ]}
          value={cardId}
          onValueChange={setCardId}
          placeholder="Buscar tarjeta…"
        />
      </Field>
      <Disclosure
        open={showCard}
        onOpenChange={setShowCard}
        label={showCard ? "Ocultar tarjeta nueva" : "Agregar tarjeta"}
      >
        <div className="flex flex-col gap-3 rounded-2xl border border-stone bg-surface p-3">
          <Field label="Nombre de la tarjeta">
            <input
              className={controlClass}
              value={cardDraft.name}
              maxLength={40}
              onChange={(event) => setCardDraft({ ...cardDraft, name: event.target.value })}
              placeholder="BBVA Oro"
            />
          </Field>
          <Field label="Terminación">
            <input
              className={`${controlClass} tabular-nums`}
              inputMode="numeric"
              maxLength={4}
              value={cardDraft.last4}
              onChange={(event) =>
                setCardDraft({
                  ...cardDraft,
                  last4: event.target.value.replace(/\D/g, "").slice(0, 4),
                })
              }
              placeholder="4521"
            />
          </Field>
          <Field label="De quién es">
            <SearchableSelect
              options={people.map((person) => ({ value: person.id, label: person.name }))}
              value={cardDraft.personId}
              onValueChange={(personId) => setCardDraft({ ...cardDraft, personId })}
              placeholder="Buscar titular…"
            />
          </Field>
          <PressButton
            type="button"
            className="h-12 rounded-2xl bg-pine text-sm font-medium text-on-pine"
            onClick={() => {
              const result = addCard(cardDraft);
              if (result) {
                setError(result);
                return;
              }
              const created = useLedger.getState().cards.at(-1);
              if (created) setCardId(created.id);
              setShowCard(false);
              setCardDraft({ name: "", last4: "", personId: me?.id ?? "" });
              setError(null);
            }}
          >
            Guardar tarjeta
          </PressButton>
        </div>
      </Disclosure>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink">Repartir el pago</span>
        <p className="mb-2 text-sm text-mist">
          Una persona o varias. Cada quien ve cuánto le falta.
        </p>
        <div className="flex flex-col gap-2">
          {people.map((person) => {
            const index = shareIds.indexOf(person.id);
            const selected = index >= 0;
            return (
              <div
                key={person.id}
                className="flex items-center gap-3 rounded-2xl border border-stone bg-surface px-3 py-2"
              >
                <PressButton
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleShare(person.id)}
                  className={`grid size-11 place-items-center rounded-full text-sm font-medium ${selected ? "bg-pine text-on-pine" : "border border-stone text-ink"}`}
                >
                  {person.name.slice(0, 1).toUpperCase()}
                </PressButton>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{person.name}</span>
                {selected ? (
                  equal ? (
                    <span className="tabular-nums text-sm text-mist">
                      {formatPercent(percents[index] ?? 0)}%
                    </span>
                  ) : (
                    <input
                      className="h-11 w-20 rounded-xl border border-stone bg-paper px-2 text-right tabular-nums outline-none focus:border-pine"
                      inputMode="decimal"
                      aria-label={`Porcentaje de ${person.name}`}
                      value={custom[person.id] ?? ""}
                      onChange={(event) =>
                        setCustom((current) => ({
                          ...current,
                          [person.id]: event.target.value.replace(/[^\d.]/g, ""),
                        }))
                      }
                    />
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <Toggle
        checked={equal}
        onCheckedChange={(value) => {
          if (!value) {
            setCustom((current) => {
              const next = { ...current };
              shareIds.forEach((id, index) => {
                if (!next[id]) next[id] = String(percents[index] ?? 0);
              });
              return next;
            });
          }
          setEqual(value);
        }}
        label="Partes iguales"
        hint="Apágalo para escribir el porcentaje de cada persona."
      />
      <Disclosure
        open={showPerson}
        onOpenChange={setShowPerson}
        label={showPerson ? "Ocultar persona" : "Agregar persona"}
      >
        <div className="flex gap-2 rounded-2xl border border-stone bg-surface p-3">
          <Field label="Nombre de la persona">
            <input
              className={controlClass}
              value={personName}
              maxLength={60}
              onChange={(event) => setPersonName(event.target.value)}
              placeholder="Nombre"
            />
          </Field>
          <PressButton
            type="button"
            className="mt-6 shrink-0 rounded-2xl bg-pine px-4 text-sm font-semibold text-on-pine"
            onClick={() => {
              const before = useLedger.getState().people.length;
              const result = addPerson(personName);
              if (result) {
                setError(result);
                return;
              }
              const created = useLedger.getState().people[before];
              if (created) setShareIds((current) => [...current, created.id]);
              setPersonName("");
              setShowPerson(false);
              setError(null);
            }}
          >
            Añadir
          </PressButton>
        </div>
      </Disclosure>
      {Number.isFinite(monthlyNumber) && monthlyNumber > 0 ? (
        <p className="rounded-2xl bg-surface px-3 py-3 text-sm text-mist">
          Con este plan vas en{" "}
          <span className="font-medium text-ink">
            {counted} de {months}
          </span>
          . Faltarían {money(previewRemaining)}. Al mes {money(monthlyNumber)}.
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-clay" role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}
      <PressButton
        type="submit"
        className="h-12 rounded-2xl bg-pine text-base font-medium text-on-pine"
      >
        Guardar compra
      </PressButton>
    </form>
  );
}

export function PersonForm({ onDone }: { onDone: () => void }) {
  const addPerson = useLedger((state) => state.addPerson);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const result = addPerson(name);
        if (result) {
          setError(result);
          return;
        }
        onDone();
      }}
    >
      <Field label="Nombre">
        <input
          className={controlClass}
          value={name}
          maxLength={60}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ana López"
          autoFocus
        />
      </Field>
      {error ? (
        <p className="text-sm text-clay" role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}
      <PressButton type="submit" className="h-12 rounded-2xl bg-pine font-medium text-on-pine">
        Guardar persona
      </PressButton>
    </form>
  );
}

export function CardForm({ cardId, onDone }: { cardId?: string; onDone: () => void }) {
  const people = useLedger((state) => state.people);
  const cards = useLedger((state) => state.cards);
  const addCard = useLedger((state) => state.addCard);
  const updateCard = useLedger((state) => state.updateCard);
  const current = cards.find((card) => card.id === cardId);
  const me = people.find((person) => person.isMe);
  const [name, setName] = useState(current?.name ?? "");
  const [last4, setLast4] = useState(current?.last4 ?? "");
  const [personId, setPersonId] = useState(current?.personId ?? me?.id ?? "");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        const input = { name, last4, personId };
        const result = cardId ? updateCard(cardId, input) : addCard(input);
        if (result) {
          setError(result);
          return;
        }
        onDone();
      }}
    >
      <Field label="Nombre de la tarjeta">
        <input
          className={controlClass}
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          placeholder="BBVA Oro"
        />
      </Field>
      <Field label="Terminación" hint="Últimos 4 números. El resto no se guarda.">
        <input
          className={`${controlClass} tabular-nums`}
          inputMode="numeric"
          maxLength={4}
          value={last4}
          onChange={(event) => setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="4521"
        />
      </Field>
      <Field label="Titular">
        <SearchableSelect
          options={people.map((person) => ({ value: person.id, label: person.name }))}
          value={personId}
          onValueChange={setPersonId}
          placeholder="Buscar titular…"
        />
      </Field>
      {error ? (
        <p className="text-sm text-clay" role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}
      <PressButton type="submit" className="h-12 rounded-2xl bg-pine font-medium text-on-pine">
        Guardar tarjeta
      </PressButton>
    </form>
  );
}
