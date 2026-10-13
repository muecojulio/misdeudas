import { useState } from "react";
import { formatDay, formatMonth, isISODate, todayISO } from "@/lib/misdeudas/dates";
import { money } from "@/lib/misdeudas/money";
import { useLedger } from "@/lib/misdeudas/store";
import type { Payable } from "@/lib/misdeudas/types";
import { controlClass, Disclosure, Field, PressButton, SearchableSelect } from "./ui";

export function PaymentForm({
  initial,
  defaultPersonId,
  onDone,
}: {
  initial?: Payable;
  defaultPersonId?: string;
  onDone: () => void;
}) {
  const people = useLedger((state) => state.people);
  const addPerson = useLedger((state) => state.addPerson);
  const savePayable = useLedger((state) => state.savePayable);
  const removePayable = useLedger((state) => state.removePayable);
  const recipients = people.filter((person) => !person.isMe);
  const [personId, setPersonId] = useState(initial?.personId ?? defaultPersonId ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? todayISO());
  const [showPerson, setShowPerson] = useState(recipients.length === 0);
  const [personName, setPersonName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const recipient = recipients.find((person) => person.id === personId);
  const numericAmount = Number(amount);

  function createPerson() {
    const result = addPerson(personName);
    if (result) {
      setError(result);
      return;
    }
    const created = useLedger.getState().people.at(-1);
    if (created) setPersonId(created.id);
    setPersonName("");
    setShowPerson(false);
    setError(null);
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const result = savePayable(
          { personId, description, amount: numericAmount, dueDate },
          initial?.id,
        );
        if (result) {
          setError(result);
          return;
        }
        onDone();
      }}
    >
      <p className="text-sm leading-relaxed text-mist">
        Registra una compra o gasto que tú tienes que pagarle a alguien. Tú eliges la fecha; no se
        marca como pagado automáticamente.
      </p>
      <Field label="A quién le tienes que pagar">
        <SearchableSelect
          options={recipients.map((person) => ({ value: person.id, label: person.name }))}
          value={personId}
          onValueChange={setPersonId}
          placeholder="Buscar persona…"
          emptyMessage="Agrega el nombre de la persona abajo."
        />
      </Field>
      <Disclosure
        open={showPerson}
        onOpenChange={setShowPerson}
        label={showPerson ? "Ocultar persona nueva" : "Agregar persona"}
      >
        <div className="flex flex-col gap-3 rounded-2xl border border-stone bg-surface p-3">
          <Field label="Nombre de la persona">
            <input
              className={controlClass}
              value={personName}
              maxLength={60}
              placeholder="Nombre"
              onChange={(event) => setPersonName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  createPerson();
                }
              }}
            />
          </Field>
          <PressButton
            type="button"
            className="h-11 rounded-2xl bg-pine font-medium text-on-pine"
            onClick={createPerson}
          >
            Guardar persona
          </PressButton>
        </div>
      </Disclosure>
      <Field label="Compra o concepto">
        <input
          className={controlClass}
          value={description}
          maxLength={120}
          placeholder="Despensa, ropa, una compra compartida…"
          onChange={(event) => setDescription(event.target.value)}
        />
      </Field>
      <Field
        label="Importe a pagar"
        hint="Escribe el importe de este pago en pesos mexicanos (MXN)."
      >
        <input
          className={`${controlClass} tabular-nums`}
          inputMode="decimal"
          value={amount}
          maxLength={20}
          placeholder="0.00"
          onChange={(event) => setAmount(event.target.value.replace(/,/g, "."))}
        />
      </Field>
      <Field label="Fecha en que tienes que pagar" hint="Esta fecha determina el mes en Resumen.">
        <input
          className={controlClass}
          type="date"
          min="0100-01-01"
          max="9999-12-31"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </Field>
      {recipient && isISODate(dueDate) && numericAmount > 0 && Number.isFinite(numericAmount) ? (
        <p className="rounded-2xl border border-stone bg-surface px-3 py-3 text-sm text-mist">
          {initial?.paid ? "Pago registrado" : "Le pagarás"}{" "}
          <strong className="font-semibold text-ink">{money(numericAmount)}</strong> a{" "}
          <strong className="font-semibold text-ink">{recipient.name}</strong> el{" "}
          {formatDay(dueDate)}.
          {initial?.paid
            ? " Se conserva como pagado."
            : ` Se sumará a tus pagos de ${formatMonth(dueDate.slice(0, 7))}.`}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-clay" role="alert">
          {error}
        </p>
      ) : null}
      <PressButton type="submit" className="h-12 rounded-2xl bg-pine font-medium text-on-pine">
        Guardar pago
      </PressButton>
      {initial ? (
        confirmDelete ? (
          <div className="flex flex-col gap-2 rounded-2xl border border-clay/30 p-3">
            <p className="text-sm text-clay">Se borrará este pago y se actualizarán los totales.</p>
            <div className="grid grid-cols-2 gap-2">
              <PressButton
                type="button"
                className="rounded-2xl border border-stone font-medium"
                onClick={() => setConfirmDelete(false)}
              >
                Cancelar
              </PressButton>
              <PressButton
                type="button"
                className="rounded-2xl bg-clay font-medium text-paper"
                onClick={() => {
                  removePayable(initial.id);
                  onDone();
                }}
              >
                Confirmar borrado
              </PressButton>
            </div>
          </div>
        ) : (
          <PressButton
            type="button"
            className="h-11 rounded-2xl text-sm font-medium text-clay"
            onClick={() => setConfirmDelete(true)}
          >
            Borrar pago
          </PressButton>
        )
      ) : null}
    </form>
  );
}
