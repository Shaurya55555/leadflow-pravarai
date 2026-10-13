"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Lead } from "@/lib/types";

interface Props {
  lead: Lead;
  onSaved: (lead: Lead) => void;
  onCancel: () => void;
  /** Lets the parent know when the form differs from the saved lead (for the discard guard). */
  onDirtyChange: (dirty: boolean) => void;
}

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export function EditLeadPanel({ lead, onSaved, onCancel, onDirtyChange }: Props) {
  const [name, setName] = useState(lead.name);
  const [company, setCompany] = useState(lead.company ?? "");
  const [phone, setPhone] = useState(lead.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(setter: (v: string) => void, field: "name" | "company" | "phone") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(e.target.value);
      const next = {
        name: field === "name" ? e.target.value : name,
        company: field === "company" ? e.target.value : company,
        phone: field === "phone" ? e.target.value : phone,
      };
      onDirtyChange(
        next.name.trim() !== lead.name ||
          next.company.trim() !== (lead.company ?? "") ||
          next.phone.trim() !== (lead.phone ?? ""),
      );
    };
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Empty strings clear optional fields (the API normalises blank to null).
      const updated = await api.updateLead(lead.id, {
        name: name.trim(),
        company: company.trim(),
        phone: phone.trim(),
      });
      onDirtyChange(false);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save changes.");
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label="Edit lead details"
      className="space-y-2 border-b border-slate-200 bg-white px-5 py-3"
    >
      <div className="grid gap-2 sm:grid-cols-3">
        <label className="block text-xs font-medium text-slate-600">
          Full Name
          <input value={name} onChange={update(setName, "name")} maxLength={120} className={inputCls} />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Company
          <input
            value={company}
            onChange={update(setCompany, "company")}
            maxLength={120}
            className={inputCls}
          />
        </label>
        <label className="block text-xs font-medium text-slate-600">
          Phone
          <input
            type="tel"
            value={phone}
            onChange={update(setPhone, "phone")}
            maxLength={40}
            className={inputCls}
          />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-rose-600">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            onDirtyChange(false);
            onCancel();
          }}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
