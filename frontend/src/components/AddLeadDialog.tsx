"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { Lead } from "@/lib/types";
import { Modal } from "./Modal";

interface Props {
  onClose: () => void;
  onCreated: (lead: Lead) => void;
}

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

export function AddLeadDialog({ onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      // Status is omitted on purpose: the API defaults new leads to "New".
      const lead = await api.createLead({
        name: name.trim(),
        company: company.trim() || undefined,
        phone: phone.trim() || undefined,
      });
      onCreated(lead);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create lead.");
      setSaving(false);
    }
  }

  return (
    <Modal label="Add new lead" title="Add New Lead" onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <div className="space-y-4 px-5 py-5">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Full Name <span className="text-red-500">*</span>
            </span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder="e.g., John Doe"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Company <span className="font-normal text-slate-400">(Optional)</span>
            </span>
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              maxLength={120}
              placeholder="e.g., Stark Industries"
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-slate-700">
              Phone <span className="font-normal text-slate-400">(Optional)</span>
            </span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              placeholder="e.g., 555-0123"
              className={inputCls}
            />
          </label>
          {error && (
            <p role="alert" className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
