"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCatalogLabel } from "@/lib/actions/admin";
import { adminCopy } from "@/lib/admin/copy";
import type { CatalogItem } from "@/lib/admin/types";

export function CatalogEditor({ items, locale }: { items: CatalogItem[]; locale: string }) {
  const t = adminCopy(locale);
  const router = useRouter();
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [nameKo, setNameKo] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<"invalid" | "conflict" | "forbidden" | "missing" | "saveError" | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const saving = useRef(false);
  const triggers = useRef(new Map<number, HTMLButtonElement>());

  function close() {
    const id = selected?.id;
    setSelected(null);
    setError(null);
    if (id !== undefined) requestAnimationFrame(() => triggers.current.get(id)?.focus());
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || saving.current) return;
    saving.current = true;
    setError(null);
    startTransition(async () => {
      try {
        const result = await updateCatalogLabel({
          kind: selected.kind, id: selected.id,
          name_ko: nameKo, expected_name_ko: selected.name_ko, reason,
        });
        if (!result.ok) { setError(result.error); return; }
        close();
        setSaved(true);
        router.refresh();
      } catch { setError("saveError"); }
      finally { saving.current = false; }
    });
  }

  return <div>
    <div role="status" aria-live="polite" className="text-sm text-accent">
      {saved && <p className="mb-4">{t.saved}</p>}
    </div>
    {items.length === 0 ? <p className="py-10 text-sm text-brown-light">{t.empty}</p> :
      <ul className="divide-y divide-border-light">
        {items.map((item) => <li key={item.id} className="py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="break-words text-base font-semibold text-brown">{item.name}</h3>
              {item.country && <p className="mt-1 text-xs text-brown-light">{item.country}</p>}
              <p className="mt-2 break-words text-sm text-brown-light">
                <span className="mr-2">{t.nameKo}</span>
                <span className="text-brown">{item.name_ko ?? t.emptyName}</span>
              </p>
            </div>
            <Button type="button" variant="secondary" size="sm" disabled={pending || selected !== null}
              ref={(node) => { if (node) triggers.current.set(item.id, node); else triggers.current.delete(item.id); }}
              aria-label={`${item.name} ${t.edit}`} aria-expanded={selected?.id === item.id}
              onClick={() => { setSelected(item); setNameKo(item.name_ko ?? ""); setReason(""); setError(null); setSaved(false); }}>
              {t.edit}
            </Button>
          </div>
          {selected?.id === item.id && <form onSubmit={save} aria-label={`${item.name} ${t.editing}`} aria-busy={pending}
            className="mt-4 space-y-4 rounded-lg bg-surface-warm p-4 sm:p-5">
            <Input label={t.nameKo} id={`label-${item.id}`} value={nameKo} maxLength={120} autoFocus disabled={pending}
              aria-describedby={`label-help-${item.id}`} onChange={(event) => setNameKo(event.target.value)} />
            <p id={`label-help-${item.id}`} className="text-xs leading-5 text-brown-light">{t.editHelp}</p>
            <Input label={t.reason} id={`reason-${item.id}`} value={reason} required minLength={3} maxLength={300}
              disabled={pending} placeholder={t.reasonPlaceholder} onChange={(event) => setReason(event.target.value)} />
            {error && <div role="alert" className="space-y-2">
              <p className="text-sm leading-6 text-red-800">{t[error]}</p>
              {(error === "conflict" || error === "missing") && <Button variant="secondary" type="button"
                onClick={() => { close(); router.refresh(); }}>{t.reload}</Button>}
            </div>}
            <div className="flex gap-2">
              <Button type="submit" loading={pending}>{pending ? t.saving : t.save}</Button>
              <Button type="button" variant="ghost" disabled={pending} onClick={close}>{t.cancel}</Button>
            </div>
          </form>}
        </li>)}
      </ul>}
  </div>;
}
