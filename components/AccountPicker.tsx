"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type AccountOption = {
  username: string;
  displayName: string;
  subjects?: string[];
  grade?: string | null;
};

type Props = {
  role: "teacher" | "student";
  value: string;
  onChange: (username: string) => void;
  /** shown above the field */
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
};

export default function AccountPicker({ role, value, onChange, label, placeholder, autoFocus }: Props) {
  const [items, setItems] = useState<AccountOption[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/public/directory?role=${role}`, { cache: "no-store" });
        const j = await r.json();
        if (!cancelled && r.ok) setItems(j.items || []);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const selected = items.find((x) => x.username === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 50);
    return items
      .filter((x) => {
        const blob = `${x.username} ${x.displayName} ${(x.subjects || []).join(" ")} ${x.grade || ""}`.toLowerCase();
        return blob.includes(q) || x.username.toLowerCase().startsWith(q) || x.displayName.toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [items, query]);

  function pick(u: AccountOption) {
    onChange(u.username);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <label className="label mt-4">{label}</label>
      <button
        type="button"
        className="input flex w-full items-center justify-between text-left"
        onClick={() => setOpen((v) => !v)}
        autoFocus={autoFocus}
      >
        <span className={selected ? "text-slate-900" : "text-slate-400"}>
          {selected
            ? role === "student"
              ? `${selected.username} · ${selected.displayName}`
              : `${selected.displayName}（${selected.username}）`
            : placeholder || "请选择账号"}
        </span>
        <span className="text-slate-400">▾</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="sticky top-0 border-b bg-white p-2">
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={role === "student" ? "输入学号或姓名筛选" : "输入姓名或账号筛选"}
              autoFocus
            />
          </div>
          {!loaded ? (
            <p className="p-3 text-sm text-slate-400">加载中…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-slate-400">没有匹配的账号</p>
          ) : (
            <ul>
              {filtered.map((u) => (
                <li key={u.username}>
                  <button
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      u.username === value ? "bg-blue-50 text-blue-700" : ""
                    }`}
                    onClick={() => pick(u)}
                  >
                    <div className="font-medium">
                      {role === "student" ? u.username : u.displayName}
                    </div>
                    <div className="text-xs text-slate-500">
                      {role === "student"
                        ? `${u.displayName}${u.grade ? ` · ${u.grade}` : ""}`
                        : `${u.username}${u.subjects?.length ? ` · ${u.subjects.join("、")}` : ""}`}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
