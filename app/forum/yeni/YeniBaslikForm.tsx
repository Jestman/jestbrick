"use client";

import { useActionState } from "react";
import { createTopic, type TopicFormState } from "@/lib/forum/actions";

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", border: "1.5px solid var(--line)",
  borderRadius: 10, fontSize: 14, fontFamily: "inherit", background: "#fff",
};

export function YeniBaslikForm({
  categories,
  defaultCategoryId,
}: {
  categories: { id: number; name: string; icon: string }[];
  defaultCategoryId?: number;
}) {
  const [state, action, pending] = useActionState<TopicFormState, FormData>(
    createTopic,
    undefined
  );

  return (
    <form action={action} className="card" style={{ padding: 22, display: "grid", gap: 14 }}>
      <label style={{ fontSize: 13.5, fontWeight: 700 }}>
        Kategori
        <select
          name="categoryId" required defaultValue={defaultCategoryId ?? categories[0]?.id}
          style={{ ...inputStyle, marginTop: 5 }}
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
      </label>

      <label style={{ fontSize: 13.5, fontWeight: 700 }}>
        Başlık
        <input
          name="title" required minLength={5} maxLength={140}
          placeholder="ör. 10307 Eyfel — parça kalitesi düştü mü?"
          style={{ ...inputStyle, marginTop: 5 }}
        />
      </label>

      <label style={{ fontSize: 13.5, fontWeight: 700 }}>
        İlk mesaj
        <textarea
          name="body" required minLength={10} rows={7} maxLength={10000}
          placeholder="Konuyu anlat…"
          style={{ ...inputStyle, marginTop: 5, resize: "vertical" }}
        />
      </label>

      <label style={{ fontSize: 13.5, fontWeight: 700 }}>
        Fotoğraflar <span style={{ fontWeight: 400, color: "var(--ink3)" }}>(en fazla 4 · isteğe bağlı)</span>
        <input
          name="photos" type="file" accept="image/*" multiple
          style={{ ...inputStyle, marginTop: 5, padding: "8px 10px" }}
        />
      </label>

      {state?.error && (
        <div className="notice" style={{ borderColor: "var(--red)", color: "var(--red)" }}>
          {state.error}
        </div>
      )}

      <button className="btn btn-y" type="submit" disabled={pending} style={{ justifySelf: "start" }}>
        {pending ? "Açılıyor…" : "💬 Başlığı Aç"}
      </button>
    </form>
  );
}
