"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, RotateCw, X } from "lucide-react";
import { api, ApiError, mediaUrl } from "@/lib/client";

export type UploadedMedia = { id: string; width: number; height: number; mimeType: string };

type Pending = {
  key: string;
  name: string;
  previewUrl: string;
  status: "uploading" | "failed";
  error?: string;
  file: File;
};

const CLIENT_MAX_EDGE = 2560;

/**
 * Shrinks a photo in the browser before it is sent.
 *
 * Phone cameras produce 4-8 MB files that no serverless request body wants,
 * and it also sidesteps HEIC: the canvas hands back a JPEG whatever went in.
 * If the browser cannot decode the file we simply send the original and let
 * the server decide.
 */
async function downscale(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, CLIENT_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.86),
    );
    return blob ?? file;
  } catch {
    return file;
  }
}

export default function MediaUploader({
  media,
  onChange,
  max = 10,
  label = "Ảnh",
  addLabel,
}: {
  media: UploadedMedia[];
  onChange: (next: UploadedMedia[]) => void;
  max?: number;
  label?: string;
  addLabel?: string;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadOne = useCallback(
    async (entry: Pending) => {
      try {
        const blob = await downscale(entry.file);
        const form = new FormData();
        form.append("file", blob, entry.name.replace(/\.[^.]+$/, "") + ".jpg");

        const res = await api.upload<{ media: UploadedMedia }>("/media", form);

        setPending((prev) => prev.filter((p) => p.key !== entry.key));
        URL.revokeObjectURL(entry.previewUrl);
        // Read the latest list at call time so parallel uploads do not clobber.
        onChange([...mediaRef.current, res.media]);
      } catch (err) {
        setPending((prev) =>
          prev.map((p) =>
            p.key === entry.key
              ? {
                  ...p,
                  status: "failed",
                  error: err instanceof ApiError ? err.message : "Tải lên thất bại.",
                }
              : p,
          ),
        );
      }
    },
    [onChange],
  );

  // Keeps the newest list available inside async callbacks.
  const mediaRef = useRef(media);
  mediaRef.current = media;

  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = max - media.length - pending.length;
    const chosen = Array.from(files).slice(0, Math.max(room, 0));

    const entries: Pending[] = chosen.map((file) => ({
      key: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      status: "uploading",
      file,
    }));

    setPending((prev) => [...prev, ...entries]);
    // Sequential: kinder to a phone on mobile data, and easier to reason about.
    void entries.reduce<Promise<void>>((chain, entry) => chain.then(() => uploadOne(entry)), Promise.resolve());
  }

  function move(index: number, delta: number) {
    const next = [...media];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function remove(id: string) {
    onChange(media.filter((m) => m.id !== id));
  }

  const full = media.length + pending.length >= max;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="label mb-0">{label}</span>
        <span className="text-xs text-[var(--color-ink-faint)]">
          {media.length + pending.length}/{max}
        </span>
      </div>

      {media.length > 0 || pending.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {media.map((m, i) => (
            <li key={m.id} className="group relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- authenticated media proxy */}
              <img
                src={mediaUrl(m.id, "thumb")}
                alt=""
                className="h-full w-full rounded-[var(--radius-drawn)] object-cover"
              />
              <button
                type="button"
                onClick={() => remove(m.id)}
                aria-label="Bỏ ảnh"
                className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--color-ink)] p-1 text-white shadow"
              >
                <X size={13} aria-hidden />
              </button>
              <div className="absolute inset-x-1 bottom-1 flex justify-between opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label="Chuyển lên trước"
                  className="rounded-full bg-[var(--color-ink)]/70 p-1 text-white disabled:opacity-30"
                >
                  <ArrowLeft size={13} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === media.length - 1}
                  aria-label="Chuyển xuống sau"
                  className="rounded-full bg-[var(--color-ink)]/70 p-1 text-white disabled:opacity-30"
                >
                  <ArrowRight size={13} aria-hidden />
                </button>
              </div>
            </li>
          ))}

          {pending.map((p) => (
            <li key={p.key} className="relative aspect-square">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img
                src={p.previewUrl}
                alt=""
                className="h-full w-full rounded-[var(--radius-drawn)] object-cover opacity-40"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1 text-center">
                {p.status === "uploading" ? (
                  <span className="text-[0.6875rem] text-[var(--color-ink-soft)]">Đang tải…</span>
                ) : (
                  <>
                    <span className="text-[0.6875rem] leading-tight text-[var(--color-danger)]">
                      {p.error}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setPending((prev) =>
                          prev.map((x) => (x.key === p.key ? { ...x, status: "uploading" } : x)),
                        );
                        void uploadOne(p);
                      }}
                      className="chip"
                    >
                      <RotateCw size={12} aria-hidden />
                      Thử lại
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        URL.revokeObjectURL(p.previewUrl);
                        setPending((prev) => prev.filter((x) => x.key !== p.key));
                      }}
                      className="text-[0.6875rem] text-[var(--color-ink-faint)] underline"
                    >
                      Bỏ
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        capture={undefined}
        className="sr-only"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={full}
        className="btn btn-quiet w-full"
      >
        <ImagePlus size={16} aria-hidden />
        {media.length + pending.length === 0 ? (addLabel ?? "Thêm ảnh") : "Thêm nữa"}
      </button>

      {full && max > 1 ? (
        <p className="text-xs text-[var(--color-ink-faint)]">
          Đã đủ số ảnh cho một mục. Tạo mục khác cho phần còn lại.
        </p>
      ) : null}
    </div>
  );
}
