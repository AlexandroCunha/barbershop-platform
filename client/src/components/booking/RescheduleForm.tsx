import { useEffect, useState, type FormEvent } from "react";
import { Notice, errorText } from "../../admin/ui";
import { todayIn } from "../../format";
import { useTenant } from "../../tenant-context";

interface Props {
  /** The day the booking is on now. The form opens there. */
  currentDate: string;
  /** The free start times on a date for the barber this booking belongs to. */
  loadTimes: (date: string) => Promise<string[]>;
  /** Moves the booking. Throws with the server's reason when the new time is refused. */
  onMove: (date: string, time: string) => Promise<void>;
  onMoved?: () => void;
}

/** Choose a new day and start time for an existing booking. The barber stays the same. */
export function RescheduleForm({ currentDate, loadTimes, onMove, onMoved }: Props) {
  const { business } = useTenant();
  const today = todayIn(business.timeZone);
  const [date, setDate] = useState(currentDate);
  const [times, setTimes] = useState<string[] | null>(null);
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    setTimes(null);
    setTime("");
    loadTimes(date)
      .then((list) => active && setTimes(list))
      .catch((caught: unknown) => {
        if (active) setResult({ kind: "error", text: errorText(caught) });
      });
    return () => {
      active = false;
    };
  }, [date, loadTimes]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!time) {
      setResult({ kind: "error", text: "Choose a new time." });
      return;
    }

    setBusy(true);
    setResult(null);
    try {
      await onMove(date, time);
      onMoved?.();
    } catch (caught) {
      setResult({ kind: "error", text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  }

  const noTimes = times !== null && times.length === 0;

  return (
    <form className="reschedule" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="reschedule-date">New date</label>
        <input
          id="reschedule-date"
          type="date"
          min={today}
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="reschedule-time">New time</label>
        <select id="reschedule-time" value={time} onChange={(event) => setTime(event.target.value)} disabled={!times?.length}>
          <option value="">
            {times === null ? "Checking…" : noTimes ? "No free times that day" : "Choose a time"}
          </option>
          {times?.map((slot) => (
            <option key={slot} value={slot}>
              {slot}
            </option>
          ))}
        </select>
      </div>
      {result && <Notice kind={result.kind}>{result.text}</Notice>}
      <button type="submit" className="btn btn-dark" disabled={busy || !time}>
        {busy ? "Moving…" : "Move booking"}
      </button>
    </form>
  );
}
