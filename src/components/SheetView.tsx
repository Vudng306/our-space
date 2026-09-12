"use client";

import clsx from "clsx";
import { Lock, Pencil } from "lucide-react";
import type { SheetDTO } from "@/server/sheets";
import { formatDayShort } from "@/lib/formatDate";
import {
  FAVOURITE_FIELDS,
  LIVING_BY_VALUE,
  MOOD_BY_VALUE,
  NOTE_FIELDS,
  TRAIT_BY_VALUE,
  zodiacFor,
} from "@/lib/sheet";
import { Avatar } from "@/components/ui";
import { HeartDoodle } from "@/components/doodles";

export default function SheetView({
  sheet,
  isMine,
  tilt,
  onEdit,
}: {
  sheet: SheetDTO;
  isMine: boolean;
  tilt?: string;
  onEdit?: () => void;
}) {
  const zodiac = zodiacFor(sheet.birthday);
  const living = sheet.livingPlace ? LIVING_BY_VALUE[sheet.livingPlace] : null;
  const mood = sheet.mood ? MOOD_BY_VALUE[sheet.mood] : null;
  const favourites = FAVOURITE_FIELDS.filter((f) => sheet[f.key]);
  const notes = NOTE_FIELDS.filter((f) => sheet[f.key]);

  return (
    <article className={clsx("card sketch tape relative px-5 pb-6 pt-8", tilt)}>
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="btn btn-ghost absolute right-2 top-4 p-2"
          aria-label="Sửa phiếu của tôi"
        >
          <Pencil size={16} aria-hidden />
        </button>
      ) : null}

      <header className="flex flex-col items-center text-center">
        <Avatar name={sheet.displayName} mediaId={sheet.avatarMediaId} size={76} />
        <h2 className="script mt-3 text-3xl leading-tight text-[var(--color-ink)]">
          {sheet.displayName}
        </h2>
        {sheet.nickname ? (
          <p className="display text-[1.0625rem] text-[var(--color-rose-deep)]">
            hay gọi là {sheet.nickname}
          </p>
        ) : null}
        {isMine ? <p className="display text-sm text-[var(--color-ink-faint)]">phiếu của bạn</p> : null}
      </header>

      <div className="mt-5 space-y-4">
        {/* facts */}
        {(living || sheet.livingCity || sheet.birthday) && (
          <ul className="space-y-1.5 text-[0.9375rem] text-[var(--color-ink-soft)]">
            {living || sheet.livingCity ? (
              <li>
                <span aria-hidden>{living?.emoji ?? "📍"}</span>{" "}
                {[living?.label, sheet.livingCity].filter(Boolean).join(" · ")}
              </li>
            ) : null}
            {sheet.birthday ? (
              <li>
                <span aria-hidden>🎂</span> {formatDayShort(sheet.birthday)}
                {zodiac ? ` · ${zodiac.emoji} ${zodiac.name}` : ""}
              </li>
            ) : null}
          </ul>
        )}

        {mood ? (
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>
              {mood.emoji}
            </span>
            <span className="display text-[1.0625rem]">Đang thấy {mood.label.toLowerCase()}</span>
          </div>
        ) : null}

        {favourites.length > 0 ? (
          <>
            <hr className="rule" />
            <div>
              <p className="display text-lg text-[var(--color-rose-deep)]">Sở thích</p>
              <ul className="mt-1.5 space-y-1 text-[0.9375rem]">
                {favourites.map((f) => (
                  <li key={f.key} className="flex gap-2">
                    <span className="w-[5.5rem] shrink-0 text-[var(--color-ink-faint)]">{f.label}</span>
                    <span className="display text-[1.0625rem] text-[var(--color-ink)]">
                      {sheet[f.key]}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : null}

        {sheet.traits.length > 0 ? (
          <>
            <hr className="rule" />
            <div>
              <p className="display text-lg text-[var(--color-rose-deep)]">Tính cách</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {sheet.traits.map((t) => (
                  <span key={t} className="chip chip-active cursor-default">
                    {TRAIT_BY_VALUE[t]?.label ?? t}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {notes.length > 0 ? (
          <>
            <hr className="rule" />
            <div className="space-y-2.5">
              {notes.map((f) => (
                <div key={f.key}>
                  <p className="text-sm text-[var(--color-ink-faint)]">
                    <span aria-hidden>{f.emoji}</span> {f.label}
                  </p>
                  <p className="display text-[1.0625rem] text-[var(--color-ink)]">{sheet[f.key]}</p>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {sheet.dream ? (
          <>
            <hr className="rule" />
            <div>
              <p className="display text-lg text-[var(--color-rose-deep)]">Ước mơ</p>
              <p className="display mt-1 whitespace-pre-wrap text-[1.0625rem] leading-relaxed text-[var(--color-ink)]">
                {sheet.dream}
              </p>
            </div>
          </>
        ) : null}

        {sheet.selfScore !== null ? (
          <>
            <hr className="rule" />
            <div>
              <p className="text-sm text-[var(--color-ink-faint)]">Tự chấm điểm bản thân</p>
              <div className="mt-1.5 flex items-center gap-3">
                <div
                  className="h-3 flex-1 overflow-hidden bg-[var(--color-paper-deep)]"
                  style={{ borderRadius: "var(--radius-pill)" }}
                >
                  <div
                    className="h-full bg-[var(--color-rose)]"
                    style={{ width: `${sheet.selfScore}%` }}
                  />
                </div>
                <span className="script text-2xl text-[var(--color-rose-deep)]">{sheet.selfScore}</span>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </article>
  );
}

/** Shown in place of the partner sheet while the exchange has not happened. */
export function LockedSheet({
  partnerName,
  reason,
  tilt,
}: {
  partnerName: string | null;
  reason: "mine_unfinished" | "theirs_unfinished" | "no_partner";
  tilt?: string;
}) {
  const copy = {
    mine_unfinished: {
      title: "Còn khoá",
      body: `Nộp phiếu của bạn trước đã, rồi phiếu của ${partnerName ?? "người kia"} sẽ mở ra.`,
    },
    theirs_unfinished: {
      title: `${partnerName ?? "Người kia"} chưa nộp`,
      body: "Phiếu của bạn đã xong. Đợi người kia điền nốt là hai bên đọc được của nhau.",
    },
    no_partner: {
      title: "Chưa có ai ở đây",
      body: "Gửi link mời cho người kia, rồi hai người cùng điền phiếu.",
    },
  }[reason];

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        tilt,
      )}
      style={{
        border: "1.5px dashed var(--color-line-strong)",
        borderRadius: "var(--radius-drawn-alt)",
      }}
    >
      {reason === "no_partner" ? (
        <HeartDoodle size={30} className="text-[var(--color-rose-line)]" />
      ) : (
        <Lock size={26} className="text-[var(--color-rose-line)]" aria-hidden />
      )}
      <p className="display text-xl text-[var(--color-ink-soft)]">{copy.title}</p>
      <p className="max-w-xs text-[0.9375rem] text-[var(--color-ink-faint)]">{copy.body}</p>
    </div>
  );
}
