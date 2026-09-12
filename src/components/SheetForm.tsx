"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import type { SheetDTO } from "@/server/sheets";
import { api, ApiError } from "@/lib/client";
import {
  FAVOURITE_FIELDS,
  LIVING_PLACES,
  NOTE_FIELDS,
  SHEET_MOODS,
  SHEET_TRAITS,
  zodiacFor,
} from "@/lib/sheet";
import { ErrorState } from "@/components/ui";
import { SquiggleDoodle } from "@/components/doodles";

type Draft = {
  nickname: string;
  livingPlace: string | null;
  livingCity: string;
  birthday: string;
  favFood: string;
  favDrink: string;
  favColor: string;
  favAnimal: string;
  favNumber: string;
  favSport: string;
  favMusic: string;
  specialHobby: string;
  idol: string;
  favTimeOfDay: string;
  mood: string | null;
  traits: string[];
  dream: string;
  selfScore: number;
};

function draftFrom(sheet: SheetDTO): Draft {
  return {
    nickname: sheet.nickname ?? "",
    livingPlace: sheet.livingPlace,
    livingCity: sheet.livingCity ?? "",
    birthday: sheet.birthday ?? "",
    favFood: sheet.favFood ?? "",
    favDrink: sheet.favDrink ?? "",
    favColor: sheet.favColor ?? "",
    favAnimal: sheet.favAnimal ?? "",
    favNumber: sheet.favNumber ?? "",
    favSport: sheet.favSport ?? "",
    favMusic: sheet.favMusic ?? "",
    specialHobby: sheet.specialHobby ?? "",
    idol: sheet.idol ?? "",
    favTimeOfDay: sheet.favTimeOfDay ?? "",
    mood: sheet.mood,
    traits: sheet.traits,
    dream: sheet.dream ?? "",
    selfScore: sheet.selfScore ?? 50,
  };
}

function payloadOf(d: Draft) {
  const text = (v: string) => (v.trim() ? v.trim() : null);
  return {
    nickname: text(d.nickname),
    livingPlace: d.livingPlace,
    livingCity: text(d.livingCity),
    birthday: d.birthday || null,
    favFood: text(d.favFood),
    favDrink: text(d.favDrink),
    favColor: text(d.favColor),
    favAnimal: text(d.favAnimal),
    favNumber: text(d.favNumber),
    favSport: text(d.favSport),
    favMusic: text(d.favMusic),
    specialHobby: text(d.specialHobby),
    idol: text(d.idol),
    favTimeOfDay: text(d.favTimeOfDay),
    mood: d.mood,
    traits: d.traits,
    dream: text(d.dream),
    selfScore: d.selfScore,
  };
}

export default function SheetForm({
  sheet,
  onSaved,
  onCancel,
}: {
  sheet: SheetDTO;
  onSaved: () => void;
  /** Only offered when the sheet has already been handed in once. */
  onCancel?: () => void;
}) {
  const [d, setD] = useState<Draft>(() => draftFrom(sheet));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "done" | null>(null);
  const [savedNote, setSavedNote] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setD((prev) => ({ ...prev, [key]: value }));

  const zodiac = zodiacFor(d.birthday || null);
  const alreadyHandedIn = sheet.completedAt !== null;

  async function save(mode: "draft" | "done") {
    setBusy(mode);
    setError(null);
    try {
      await api.patch("/sheets", payloadOf(d));
      if (mode === "done") {
        await api.post("/sheets/complete");
        onSaved();
      } else {
        setSavedNote(true);
        setTimeout(() => setSavedNote(false), 2500);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chưa lưu được.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save("done");
      }}
      className="mx-auto max-w-3xl space-y-5"
    >
      {/* --- banner ------------------------------------------------------- */}
      <header className="text-center">
        <p className="display text-sm tracking-[0.35em] text-[var(--color-ink-faint)]">OUR SPACE</p>
        <h1 className="script mt-1 text-4xl text-[var(--color-rose-deep)] sm:text-5xl">
          Giới thiệu bản thân tớ
        </h1>
        <SquiggleDoodle className="mx-auto mt-2 text-[var(--color-line-strong)]" />
      </header>

      {error ? <ErrorState message={error} /> : null}

      {/* --- row 1: where / who / birthday -------------------------------- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Block title="Nơi tớ sống">
          <div className="flex gap-3">
            {LIVING_PLACES.map((p) => (
              <button
                key={p.value}
                type="button"
                aria-pressed={d.livingPlace === p.value}
                onClick={() => set("livingPlace", d.livingPlace === p.value ? null : p.value)}
                className={clsx(
                  "flex flex-1 flex-col items-center gap-1 px-3 py-3 transition-colors",
                  d.livingPlace === p.value
                    ? "bg-[var(--color-rose-soft)]"
                    : "hover:bg-[var(--color-paper-deep)]",
                )}
                style={{
                  border: "1.5px solid var(--color-line-strong)",
                  borderRadius: "var(--radius-drawn)",
                }}
              >
                <span className="text-2xl" aria-hidden>
                  {p.emoji}
                </span>
                <span className="display text-[0.9375rem]">{p.label}</span>
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="display text-[0.9375rem] text-[var(--color-ink-soft)]">Ở</span>
            <input
              className="field-line mt-1"
              maxLength={60}
              placeholder="Hà Nội"
              value={d.livingCity}
              onChange={(e) => set("livingCity", e.target.value)}
            />
          </label>
        </Block>

        <Block title="Tớ là">
          <Line label="Tên" value={sheet.displayName} readOnly />
          <label className="mt-3 block">
            <span className="display text-[0.9375rem] text-[var(--color-ink-soft)]">Biệt danh</span>
            <input
              className="field-line mt-1"
              maxLength={40}
              placeholder="người ta hay gọi tớ là…"
              value={d.nickname}
              onChange={(e) => set("nickname", e.target.value)}
            />
          </label>
        </Block>
      </div>

      <Block title="Sinh nhật tớ">
        <div className="flex flex-wrap items-end gap-4">
          <label className="min-w-[10rem] flex-1">
            <span className="display text-[0.9375rem] text-[var(--color-ink-soft)]">Ngày</span>
            <input
              type="date"
              className="field-line mt-1"
              value={d.birthday}
              onChange={(e) => set("birthday", e.target.value)}
            />
          </label>
          <p className="display pb-1 text-[1.0625rem] text-[var(--color-ink-soft)]">
            Cung:{" "}
            {zodiac ? (
              <span className="text-[var(--color-rose-deep)]">
                {zodiac.emoji} {zodiac.name}
              </span>
            ) : (
              <span className="italic text-[var(--color-ink-faint)]">chọn ngày là tự hiện</span>
            )}
          </p>
        </div>
      </Block>

      {/* --- row 2: favourites / mood ------------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Block title="Sở thích" hint="Điền thứ bạn yêu thích">
          <div className="space-y-2.5">
            {FAVOURITE_FIELDS.map((f) => (
              <label key={f.key} className="flex items-baseline gap-2">
                <span className="display w-24 shrink-0 text-[1.0625rem] text-[var(--color-ink-soft)]">
                  + {f.label}
                </span>
                <input
                  className="field-line"
                  maxLength={60}
                  placeholder={f.placeholder}
                  value={d[f.key]}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </Block>

        <Block title="Tâm trạng hiện tại">
          <div className="grid grid-cols-5 gap-2">
            {SHEET_MOODS.map((m) => {
              const on = d.mood === m.value;
              return (
                <button
                  key={m.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set("mood", on ? null : m.value)}
                  className={clsx(
                    "flex flex-col items-center gap-1 px-1 py-2 transition-colors",
                    on ? "bg-[var(--color-rose-soft)]" : "hover:bg-[var(--color-paper-deep)]",
                  )}
                  style={{
                    border: `1.5px solid ${on ? "var(--color-rose)" : "transparent"}`,
                    borderRadius: "var(--radius-drawn)",
                  }}
                >
                  <span className="text-2xl" aria-hidden>
                    {m.emoji}
                  </span>
                  <span className="display text-center text-[0.75rem] leading-tight">{m.label}</span>
                </button>
              );
            })}
          </div>
        </Block>
      </div>

      {/* --- row 3: notes / traits / dream -------------------------------- */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          {NOTE_FIELDS.map((f) => (
            <Block key={f.key} title={`${f.emoji} ${f.label}`}>
              <textarea
                className="field-line min-h-[3.5rem] resize-y"
                maxLength={200}
                placeholder={f.placeholder}
                value={d[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
              />
            </Block>
          ))}
        </div>

        <div className="space-y-4">
          <Block title="Tính cách">
            <ul className="space-y-2">
              {SHEET_TRAITS.map((t) => {
                const on = d.traits.includes(t.value);
                return (
                  <li key={t.value}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          "traits",
                          on ? d.traits.filter((x) => x !== t.value) : [...d.traits, t.value],
                        )
                      }
                      className="flex w-full items-center gap-3 text-left"
                    >
                      <span className="tickbox" data-checked={on}>
                        {on ? <Check size={15} strokeWidth={2.6} aria-hidden /> : null}
                      </span>
                      <span className="display text-[1.0625rem]">{t.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Block>

          <Block title="🐷 Ước mơ">
            <textarea
              className="field-line min-h-[6rem] resize-y"
              maxLength={600}
              placeholder="sau này tớ muốn…"
              value={d.dream}
              onChange={(e) => set("dream", e.target.value)}
            />
          </Block>
        </div>
      </div>

      {/* --- self score ---------------------------------------------------- */}
      <Block title="Tự chấm điểm bản thân">
        <div className="flex items-center gap-3">
          <span className="display text-[1.0625rem] text-[var(--color-ink-soft)]">0</span>
          <input
            type="range"
            min={0}
            max={100}
            value={d.selfScore}
            onChange={(e) => set("selfScore", Number(e.target.value))}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-[var(--color-paper-deep)] accent-[var(--color-rose)]"
            aria-label="Tự chấm điểm bản thân"
          />
          <span className="display text-[1.0625rem] text-[var(--color-ink-soft)]">100</span>
          <span className="script w-14 text-right text-2xl text-[var(--color-rose-deep)]">
            {d.selfScore}
          </span>
        </div>
      </Block>

      {/* --- actions ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
        {savedNote ? (
          <span className="display text-[var(--color-sage)]">Đã lưu tạm ✓</span>
        ) : null}

        {onCancel ? (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy !== null}>
            Thôi
          </button>
        ) : null}

        <button
          type="button"
          className="btn btn-quiet"
          onClick={() => void save("draft")}
          disabled={busy !== null}
        >
          {busy === "draft" ? "Đang lưu…" : "Lưu tạm"}
        </button>

        <button type="submit" className="btn btn-primary" disabled={busy !== null}>
          {busy === "done" ? "Đang nộp…" : alreadyHandedIn ? "Lưu phiếu" : "Xong, nộp phiếu"}
        </button>
      </div>

      {!alreadyHandedIn ? (
        <p className="display pb-2 text-center text-[var(--color-ink-soft)]">
          Nộp phiếu xong bạn mới đọc được phiếu của người kia.
        </p>
      ) : null}
    </form>
  );
}

// ---------------------------------------------------------------------------

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-4">
      <h2 className="display text-xl text-[var(--color-rose-deep)]">{title}</h2>
      {hint ? <p className="mb-2 text-sm italic text-[var(--color-ink-faint)]">({hint})</p> : null}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </section>
  );
}

function Line({ label, value, readOnly }: { label: string; value: string; readOnly?: boolean }) {
  return (
    <label className="block">
      <span className="display text-[0.9375rem] text-[var(--color-ink-soft)]">{label}</span>
      <input className="field-line mt-1" value={value} readOnly={readOnly} tabIndex={readOnly ? -1 : 0} />
    </label>
  );
}
