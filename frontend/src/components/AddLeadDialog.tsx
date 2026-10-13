"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { STATUSES, type Lead, type LeadStatus } from "@/lib/types";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
  onCreated: (lead: Lead) => void;
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200";

export function AddLeadDialog({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<LeadStatus>("New");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const lead = await api.createLead({
        name: name.trim(),
        company: company.trim() || undefined,
        phone: phone.trim() || undefined,
        status,
      });
      onCreated(lead);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create lead.");
      setSaving(false);
    }
  }

  return (
    <Modal title="Add new lead" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 overflow-y-auto px-5 py-5">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">
            Name <span className="text-rose-600">*</span>
          </span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            placeholder="Jane Cooper"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Company</span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={120}
            placeholder="Acme Inc."
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            maxLength={40}
            placeholder="+91 98765 43210"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Status</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as LeadStatus)}
            className={inputCls}
          >
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {saving ? "Adding..." : "Add lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
