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
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  /** tighter spacing for homepage cards */
  compact?: boolean;
};

export default function AccountPicker({
  role,
  value,
  onChange,
  label,
  placeholder,
  autoFocus,
  compact,
}: Props) {
  const [items, setItems] = useState<AccountOption[]>([]);
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

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    if (!q) return items.slice(0, 50);
    return items
      .filter((x) => {
        const blob = `${x.username} ${x.displayName} ${(x.subjects || []).join(" ")} ${x.grade || ""}`.toLowerCase();
        return blob.includes(q) || x.username.toLowerCase().startsWith(q) || x.displayName.toLowerCase().includes(q);
      })
      .slice(0, 50);
  }, [items, value]);

  const exact = items.find((x) => x.username === value);
  const hint =
    exact &&
    (role === "student"
      ? `${exact.displayName}${exact.grade ? ` · ${exact.grade}` : ""}`
      : `${exact.displayName}${exact.subjects?.length ? ` · ${exact.subjects.join("、")}` : ""}`);

  return (
    <div ref={wrapRef} className="relative">
      <label className={`label ${compact ? "mt-2" : "mt-4"}`}>{label}</label>
      <input
        className="input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value.trimStart());
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || (role === "student" ? "输入或选择学号" : "输入或选择老师账号")}
        autoFocus={autoFocus}
        autoComplete="username"
        spellCheck={false}
      />
      {hint && <p className="mt-1 text-xs text-slate-500">已匹配：{hint}</p>}
      {open && (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {!loaded ? (
            <p className="p-3 text-sm text-slate-400">加载中…</p>
          ) : filtered.length === 0 ? (
            <p className="p-3 text-sm text-slate-400">
              {items.length === 0 ? "暂无可用账号，请先让校长建档" : "没有匹配，可继续输入完整账号"}
            </p>
          ) : (
            <ul>
              {filtered.map((u) => (
                <li key={u.username}>
                  <button
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                      u.username === value ? "bg-blue-50 text-blue-700" : ""
                    }`}
                    onClick={() => {
                      onChange(u.username);
                      setOpen(false);
                    }}
                  >
                    <div className="font-medium">{role === "student" ? u.username : u.displayName}</div>
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
