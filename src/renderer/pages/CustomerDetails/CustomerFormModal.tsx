/**
 * cQikly — Customer Add/Edit Modal
 * Phase 8a (base) | Phase 8b-i: added internal notes + customer since date
 */
import React, { useState, useEffect, useRef } from 'react'
import type { CustomerRecord } from '../../services/customer.service'

interface Props {
  mode: 'add' | 'edit'
  initial?: Partial<CustomerRecord>
  onSave: (data: Omit<CustomerRecord, 'id' | 'createdAt'>) => void
  onClose: () => void
}

const REG_TYPES = ['Regular', 'Composition', 'Unregistered', 'Consumer', 'SEZ', 'Overseas']

interface FieldDef {
  key: string
  label: string
  span: number
  required?: boolean
  select?: string[]
  type?: string
}

interface FieldGroup {
  label: string
  fields: FieldDef[]
}

const FIELD_GROUPS: FieldGroup[] = [
  {
    label: 'Basic Info',
    fields: [
      { key: 'partyName', label: 'Party Name *', required: true, span: 2 },
      { key: 'contactPerson', label: 'Contact Person', span: 1 },
      { key: 'group', label: 'Group', span: 1 },
    ],
  },
  {
    label: 'Contact',
    fields: [
      { key: 'phoneNo', label: 'Phone No', span: 1 },
      { key: 'mobileNo', label: 'Mobile No', span: 1 },
      { key: 'email', label: 'Email', span: 1 },
      { key: 'website', label: 'Website', span: 1 },
    ],
  },
  {
    label: 'Address',
    fields: [
      { key: 'address', label: 'Address', span: 2 },
      { key: 'pincode', label: 'Pincode', span: 1 },
      { key: 'stateName', label: 'State Name', span: 1 },
    ],
  },
  {
    label: 'Tax & Compliance',
    fields: [
      { key: 'panNo', label: 'PAN No', span: 1 },
      { key: 'gstin', label: 'GSTIN', span: 1 },
      { key: 'regType', label: 'Reg Type', span: 1, select: REG_TYPES },
      { key: 'creditLimit', label: 'Credit Limit (₹)', span: 1, type: 'number' },
    ],
  },
]

export default function CustomerFormModal({ mode, initial = {}, onSave, onClose }: Props): React.ReactElement {
  const [form, setForm] = useState<Record<string, string>>({
    partyName: initial.partyName ?? '',
    contactPerson: initial.contactPerson ?? '',
    group: initial.group ?? '',
    phoneNo: initial.phoneNo ?? '',
    mobileNo: initial.mobileNo ?? '',
    email: initial.email ?? '',
    website: initial.website ?? '',
    address: initial.address ?? '',
    pincode: initial.pincode ?? '',
    stateName: initial.stateName ?? '',
    panNo: initial.panNo ?? '',
    gstin: initial.gstin ?? '',
    regType: initial.regType ?? '',
    creditLimit: initial.creditLimit != null ? String(initial.creditLimit) : '',
    customerSinceDate: initial.customerSinceDate ?? '',
    internalNotes: initial.internalNotes ?? '',
  })
  const [error, setError] = useState('')
  const firstRef = useRef<HTMLInputElement>(null)

  useEffect(() => { firstRef.current?.focus() }, [])

  function handleChange(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
    if (key === 'partyName') setError('')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.partyName.trim()) { setError('Party Name is required.'); return }
    onSave({
      partyName: form.partyName.trim(),
      contactPerson: form.contactPerson.trim() || undefined,
      group: form.group.trim() || undefined,
      phoneNo: form.phoneNo.trim() || undefined,
      mobileNo: form.mobileNo.trim() || undefined,
      email: form.email.trim() || undefined,
      website: form.website.trim() || undefined,
      address: form.address.trim() || undefined,
      pincode: form.pincode.trim() || undefined,
      stateName: form.stateName.trim() || undefined,
      panNo: form.panNo.trim() || undefined,
      gstin: form.gstin.trim() || undefined,
      regType: form.regType.trim() || undefined,
      creditLimit: form.creditLimit.trim() ? parseFloat(form.creditLimit) : undefined,
      customerSinceDate: form.customerSinceDate.trim() || undefined,
      internalNotes: form.internalNotes.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#1e1e2a] border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 flex-shrink-0">
          <h2 className="text-white font-semibold text-lg">
            {mode === 'add' ? '+ Add Customer' : 'Edit Customer'}
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {FIELD_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-xs font-semibold text-[#a78bfa] uppercase tracking-widest mb-2">{group.label}</p>
              <div className="grid grid-cols-2 gap-3">
                {group.fields.map(f => (
                  <div key={f.key} className={f.span === 2 ? 'col-span-2' : 'col-span-1'}>
                    <label className="block text-xs text-white/50 mb-1">{f.label}</label>
                    {f.select ? (
                      <select
                        value={form[f.key]}
                        onChange={e => handleChange(f.key, e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#a78bfa]/60"
                      >
                        <option value="">— Select —</option>
                        {f.select.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        ref={f.key === 'partyName' ? firstRef : undefined}
                        type={f.type ?? 'text'}
                        value={form[f.key]}
                        onChange={e => handleChange(f.key, e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#a78bfa]/60 placeholder-white/20"
                        placeholder={f.label.replace(' *', '')}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* ── Phase 8b-i: Customer Since Date ── */}
          <div>
            <p className="text-xs font-semibold text-[#a78bfa] uppercase tracking-widest mb-2">Relationship</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-white/50 mb-1">
                  Customer Since
                  <span className="ml-1 text-white/25 font-normal normal-case">(auto-set from first bill · editable)</span>
                </label>
                <input
                  type="date"
                  value={form.customerSinceDate}
                  onChange={e => handleChange('customerSinceDate', e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#a78bfa]/60"
                />
              </div>
            </div>
          </div>

          {/* ── Phase 8b-i: Internal Notes ── */}
          <div>
            <p className="text-xs font-semibold text-[#a78bfa] uppercase tracking-widest mb-2">
              Internal Notes
              <span className="ml-2 text-white/25 font-normal normal-case text-[10px] tracking-normal">
                🔒 Private · never shown on any bill, PDF, or print
              </span>
            </p>
            <textarea
              value={form.internalNotes}
              onChange={e => handleChange('internalNotes', e.target.value)}
              rows={3}
              placeholder="Private notes about this customer — payment behaviour, preferences, flags, etc. Never appears on bills or PDFs."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#a78bfa]/60 placeholder-white/20 resize-none"
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 text-sm transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            className="px-6 py-2 rounded-lg bg-[#a78bfa] hover:bg-[#9c71fa] text-white font-semibold text-sm transition-colors"
          >
            {mode === 'add' ? 'Add Customer' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
