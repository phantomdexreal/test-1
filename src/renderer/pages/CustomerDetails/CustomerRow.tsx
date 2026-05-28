/**
 * cQikly — Customer Table Row
 * Phase 8a (base) | Phase 8b-ii: Added "Record Payment" + "Ledger" action buttons
 */
import React from 'react'
import type { CustomerWithStats } from '../../services/customer.service'

interface Props {
  customer: CustomerWithStats
  selected: boolean
  onSelect: (id: number, checked: boolean) => void
  onEdit: (customer: CustomerWithStats) => void
  onDelete: (customer: CustomerWithStats) => void
  onViewLedger: (customer: CustomerWithStats) => void
  onRecordPayment: (customer: CustomerWithStats) => void
  columns: string[]
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export default function CustomerRow({
  customer, selected, onSelect, onEdit, onDelete,
  onViewLedger, onRecordPayment, columns,
}: Props): React.ReactElement {
  const over = (customer.creditLimit ?? 0) > 0 && customer.outstandingBalance > (customer.creditLimit ?? 0)

  return (
    <tr
      className={`border-b border-white/5 hover:bg-white/3 transition-colors group ${selected ? 'bg-[#a78bfa]/10' : ''}`}
    >
      {/* Checkbox */}
      <td className="px-3 py-2.5 w-8">
        <input
          type="checkbox"
          checked={selected}
          onChange={e => onSelect(customer.id!, e.target.checked)}
          className="accent-[#a78bfa] cursor-pointer"
        />
      </td>

      {/* Party Name */}
      <td className="px-3 py-2.5 min-w-[140px]">
        <span className="text-white font-medium text-sm">{customer.partyName}</span>
        {customer.group && (
          <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-[#a78bfa]/20 text-[#a78bfa]">{customer.group}</span>
        )}
      </td>

      {columns.includes('address') && (
        <td className="px-3 py-2.5 text-white/50 text-xs max-w-[160px] truncate" title={customer.address}>
          {customer.address || '—'}
        </td>
      )}
      {columns.includes('group') && (
        <td className="px-3 py-2.5 text-white/60 text-xs">{customer.group || '—'}</td>
      )}
      {columns.includes('pincode') && (
        <td className="px-3 py-2.5 text-white/50 text-xs">{customer.pincode || '—'}</td>
      )}
      {columns.includes('stateName') && (
        <td className="px-3 py-2.5 text-white/50 text-xs">{customer.stateName || '—'}</td>
      )}
      {columns.includes('contactPerson') && (
        <td className="px-3 py-2.5 text-white/60 text-xs">{customer.contactPerson || '—'}</td>
      )}
      {columns.includes('phoneNo') && (
        <td className="px-3 py-2.5 text-white/60 text-xs">{customer.phoneNo || '—'}</td>
      )}
      {columns.includes('mobileNo') && (
        <td className="px-3 py-2.5 text-white/60 text-xs">{customer.mobileNo || '—'}</td>
      )}
      {columns.includes('email') && (
        <td className="px-3 py-2.5 text-white/50 text-xs max-w-[140px] truncate" title={customer.email}>
          {customer.email || '—'}
        </td>
      )}
      {columns.includes('website') && (
        <td className="px-3 py-2.5 text-white/50 text-xs max-w-[120px] truncate" title={customer.website}>
          {customer.website || '—'}
        </td>
      )}
      {columns.includes('panNo') && (
        <td className="px-3 py-2.5 text-white/50 text-xs font-mono">{customer.panNo || '—'}</td>
      )}
      {columns.includes('gstin') && (
        <td className="px-3 py-2.5 text-white/50 text-xs font-mono">{customer.gstin || '—'}</td>
      )}
      {columns.includes('regType') && (
        <td className="px-3 py-2.5 text-xs">
          {customer.regType ? (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
              customer.regType === 'Regular' ? 'bg-emerald-500/20 text-emerald-400' :
              customer.regType === 'Unregistered' ? 'bg-gray-500/20 text-gray-400' :
              customer.regType === 'Composition' ? 'bg-amber-500/20 text-amber-400' :
              'bg-blue-500/20 text-blue-400'
            }`}>{customer.regType}</span>
          ) : '—'}
        </td>
      )}
      {columns.includes('creditLimit') && (
        <td className="px-3 py-2.5 text-white/60 text-xs text-right">
          {(customer.creditLimit ?? 0) > 0 ? fmt(customer.creditLimit!) : '—'}
        </td>
      )}

      {/* Bill Count — always shown */}
      <td className="px-3 py-2.5 text-center">
        <span className="text-sm text-white/70 font-medium">{customer.billCount}</span>
      </td>

      {/* Outstanding Balance — always shown */}
      <td className="px-3 py-2.5 text-right">
        <span className={`text-sm font-semibold ${
          over ? 'text-red-400' :
          customer.outstandingBalance > 0 ? 'text-amber-400' : 'text-emerald-400'
        }`}>
          {customer.outstandingBalance > 0 ? fmt(customer.outstandingBalance) : '—'}
        </span>
        {over && (
          <span className="ml-1 text-[10px] text-red-400" title="Exceeds credit limit">⚠</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5 text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Record Payment */}
          <button
            onClick={() => onRecordPayment(customer)}
            className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
            title="Record Payment"
          >
            💳 Pay
          </button>

          {/* View Ledger */}
          <button
            onClick={() => onViewLedger(customer)}
            className="px-2 py-1 rounded text-[11px] font-semibold bg-[#a78bfa]/15 text-[#a78bfa] hover:bg-[#a78bfa]/25 transition-colors"
            title="View Ledger"
          >
            📒 Ledger
          </button>

          <button
            onClick={() => onEdit(customer)}
            className="p-1.5 rounded hover:bg-white/10 text-white/40 hover:text-[#a78bfa] transition-colors text-xs"
            title="Edit"
          >✏</button>
          <button
            onClick={() => onDelete(customer)}
            className="p-1.5 rounded hover:bg-red-500/10 text-white/40 hover:text-red-400 transition-colors text-xs"
            title="Delete"
          >🗑</button>
        </div>
      </td>
    </tr>
  )
}
