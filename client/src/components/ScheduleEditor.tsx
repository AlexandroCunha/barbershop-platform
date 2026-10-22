import { useEffect, useState, type FormEvent } from "react";
import { Notice, errorText } from "../admin/ui";
import { DAY_LABELS } from "../format";
import { useTenant } from "../tenant-context";
import { DAYS, type BarberHours, type Day, type DayHours } from "../types";

/** Bookings start on the half hour, so the hours a barber can pick are on that grid. */
const GRID_MINUTES = 30;

type Week = Record<Day, DayHours | null>;

const toMinutes = (time: string): number => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours! * 60 + minutes!;
};

const toTime = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Every half hour from the shop's opening to its closing time. */
function gridFor(shop: DayHours): string[] {
  const first = Math.ceil(toMinutes(shop.open) / GRID_MINUTES) * GRID_MINUTES;
  const last = Math.floor(toMinutes(shop.close) / GRID_MINUTES) * GRID_MINUTES;
  const times: string[] = [];
  for (let minute = first; minute <= last; minute += GRID_MINUTES) {
    times.push(toTime(minute));
  }
  return times;
}

/**
 * Working hours for each day of the week. With a professionalId it is the owner setting a barber's
 * hours; without one it is the signed-in barber setting their own. The shop's opening hours limit
 * every choice.
 */
export function ScheduleEditor({ professionalId, name }: { professionalId: number | null; name: string }) {
  const { api, business } = useTenant();
  const [view, setView] = useState<BarberHours | null>(null);
  const [draft, setDraft] = useState<Week | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    const request = professionalId === null ? api.barber.hours() : api.owner.barberHours(professionalId);
    request
      .then((loaded) => {
        setView(loaded);
        setDraft(loaded.days);
      })
      .catch((caught: unknown) => setLoadError(errorText(caught)));
  }, [api, professionalId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    setSaving(true);
    setResult(null);
    try {
      const saved =
        professionalId === null
          ? await api.barber.saveHours(draft)
          : await api.owner.saveBarberHours(professionalId, draft);
      setView(saved);
      setDraft(saved.days);
      setResult({ kind: "ok", text: "Hours saved." });
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <Notice kind="error">{loadError}</Notice>;
  if (!view || !draft) return <p className="status">Loading hours…</p>;

  return (
    <form className="owner-card owner-form" onSubmit={handleSubmit} noValidate>
      <p className="eyebrow">{professionalId === null ? "Your working hours" : `Working hours · ${name}`}</p>
      <p className="muted">
        {view.custom
          ? "Online bookings only offer these hours."
          : "Following the shop's opening hours. Save a schedule to set their own."}
      </p>
      <div className="schedule">
        {DAYS.map((day) => (
          <DayRow
            key={day}
            day={day}
            value={draft[day]}
            shop={business.hours[day]}
            onChange={(next) => setDraft((current) => (current ? { ...current, [day]: next } : current))}
          />
        ))}
      </div>
      {result && <Notice kind={result.kind}>{result.text}</Notice>}
      <div className="owner-savebar">
        <span />
        <button type="submit" className="btn btn-dark" disabled={saving}>
          {saving ? "Saving…" : "Save hours"}
        </button>
      </div>
    </form>
  );
}

function DayRow({
  day,
  value,
  shop,
  onChange,
}: {
  day: Day;
  value: DayHours | null;
  shop: DayHours | null;
  onChange: (next: DayHours | null) => void;
}) {
  const label = DAY_LABELS[day];

  if (!shop) {
    return (
      <div className="schedule-row">
        <span className="schedule-day">{label}</span>
        <span className="muted">Shop closed</span>
      </div>
    );
  }

  const grid = gridFor(shop);
  const starts = grid.slice(0, -1);

  if (!value) {
    return (
      <div className="schedule-row">
        <label className="schedule-day">
          <input
            type="checkbox"
            checked={false}
            disabled={grid.length < 2}
            onChange={() => onChange({ open: grid[0]!, close: grid[grid.length - 1]! })}
          />{" "}
          {label}
        </label>
        <span className="muted">Day off</span>
      </div>
    );
  }

  function changeOpen(open: string) {
    const closeIsValid = toMinutes(value!.close) > toMinutes(open);
    const close = closeIsValid ? value!.close : (grid.find((time) => toMinutes(time) > toMinutes(open)) ?? value!.close);
    onChange({ open, close });
  }

  return (
    <div className="schedule-row">
      <label className="schedule-day">
        <input type="checkbox" checked onChange={() => onChange(null)} /> {label}
      </label>
      <div className="schedule-times">
        <select aria-label={`${label} starts`} value={value.open} onChange={(event) => changeOpen(event.target.value)}>
          {starts.map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </select>
        <span aria-hidden="true">to</span>
        <select
          aria-label={`${label} ends`}
          value={value.close}
          onChange={(event) => onChange({ ...value, close: event.target.value })}
        >
          {grid
            .filter((time) => toMinutes(time) > toMinutes(value.open))
            .map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
}
