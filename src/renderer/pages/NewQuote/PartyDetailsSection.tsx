/**
 * cQikly — PartyDetailsSection
 * Built in: Phase 4b-i
 *
 * Renders the party details row on the New Quote page:
 *   - Party Name field with fuzzy autocomplete from existing customers
 *   - Phone Number field
 *   - Transport Name field with fuzzy autocomplete from saved transporters list
 *     and per-customer transport memory (Hard Spec #17)
 *   - Expandable Extra Info section (Address, GSTIN, Notes)
 *
 * On customer select: autofills Phone + Transport (most recent for that customer).
 * Transport updated on bill save: handled via onTransportChange prop + parent calls
 *   customerService.updateCustomerTransport() on bill save.
 *
 * Hard Spec #4: Auto-create customer on first bill save — parent passes
 *   partyDetails to quoteService.saveBill() which calls ensureCustomerExists().
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { ChevronDown, ChevronUp, User, Phone, Truck, MapPin, Hash, FileText, X } from 'lucide-react'
import {
  loadCustomers,
  loadTransporters,
  searchCustomers,
  searchTransporters,
} from '../../services/customer.service'
import type { CustomerRecord } from '../../services/db.service'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PartyDetails {
  partyName: string
  phone: string
  transportName: string
  // Extra info (expandable)
  address: string
  gstin: string
  notes: string
  // Internal: resolved customer ID if existing customer was selected
  resolvedCustomerId: number | null
}

interface PartyDetailsSectionProps {
  value: PartyDetails
  onChange: (details: PartyDetails) => void
  /** Called when user selects an existing customer from autocomplete */
  onCustomerSelect?: (customer: CustomerRecord) => void
}

const EMPTY_DETAILS: PartyDetails = {
  partyName: '',
  phone: '',
  transportName: '',
  address: '',
  gstin: '',
  notes: '',
  resolvedCustomerId: null,
}

// ─── Styles (CSS-variable based, hot-swappable with theme) ───────────────────

const S = {
  font: '"Inter", system-ui, sans-serif',
  accent: 'var(--cq-accent)',
  text: 'var(--cq-text-primary)',
  textMuted: 'var(--cq-text-muted)',
  surface: 'var(--cq-surface)',
  surfaceRaised: 'var(--cq-surface-raised)',
  border: 'var(--cq-border)',
  borderFocus: 'var(--cq-accent)',
  radius: '8px',
  radiusSm: '6px',
}

function inputStyle(focused: boolean): React.CSSProperties {
  return {
    fontFamily: S.font,
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 12px 9px 36px',
    fontSize: '0.875rem',
    color: S.text,
    background: S.surfaceRaised,
    border: `1.5px solid ${focused ? S.borderFocus : S.border}`,
    borderRadius: S.radius,
    outline: 'none',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: focused ? `0 0 0 3px color-mix(in srgb, var(--cq-accent) 15%, transparent)` : 'none',
  }
}

function dropdownItemStyle(highlighted: boolean): React.CSSProperties {
  return {
    padding: '9px 14px',
    fontSize: '0.875rem',
    color: highlighted ? S.accent : S.text,
    background: highlighted ? 'color-mix(in srgb, var(--cq-accent) 10%, transparent)' : 'transparent',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    transition: 'background 0.1s',
    borderRadius: S.radiusSm,
  }
}

// ─── FuzzyInput — reusable autocomplete field ─────────────────────────────────

interface FuzzyInputProps {
  label: string
  value: string
  onChange: (val: string) => void
  onSelect: (val: string) => void
  onSearch: (query: string) => string[]
  icon: React.ReactNode
  placeholder?: string
  renderItem?: (item: string, highlighted: boolean) => React.ReactNode
  disabled?: boolean
}

function FuzzyInput({
  label: _label,
  value,
  onChange,
  onSelect,
  onSearch,
  icon,
  placeholder,
  renderItem,
  disabled,
}: FuzzyInputProps): React.ReactElement {
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [focused, setFocused] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const suppressSearch = useRef(false)

  const showDropdown = focused && suggestions.length > 0

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)
    if (!suppressSearch.current) {
      const results = onSearch(v)
      setSuggestions(results)
      setHighlightedIdx(-1)
    }
    suppressSearch.current = false
  }, [onChange, onSearch])

  const handleSelect = useCallback((item: string) => {
    suppressSearch.current = true
    onSelect(item)
    setSuggestions([])
    setHighlightedIdx(-1)
    inputRef.current?.blur()
  }, [onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && highlightedIdx >= 0) {
      e.preventDefault()
      handleSelect(suggestions[highlightedIdx])
    } else if (e.key === 'Escape') {
      setSuggestions([])
      setHighlightedIdx(-1)
    }
  }, [showDropdown, suggestions, highlightedIdx, handleSelect])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setSuggestions([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Icon */}
      <span style={{
        position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
        color: focused ? S.accent : S.textMuted,
        pointerEvents: 'none', display: 'flex', alignItems: 'center',
        transition: 'color 0.15s',
        zIndex: 1,
      }}>
        {icon}
      </span>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        style={inputStyle(focused)}
      />

      {/* Clear button */}
      {value && !disabled && (
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); onChange(''); setSuggestions([]) }}
          style={{
            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
            color: S.textMuted, display: 'flex', alignItems: 'center',
          }}
          tabIndex={-1}
        >
          <X size={13} />
        </button>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: S.surfaceRaised,
            border: `1.5px solid ${S.border}`,
            borderRadius: S.radius,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            zIndex: 100,
            overflow: 'hidden',
            padding: '4px',
          }}
        >
          {suggestions.map((item, idx) => (
            <div
              key={item}
              onMouseDown={e => { e.preventDefault(); handleSelect(item) }}
              onMouseEnter={() => setHighlightedIdx(idx)}
              style={dropdownItemStyle(idx === highlightedIdx)}
            >
              {renderItem ? renderItem(item, idx === highlightedIdx) : item}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── PartyName autocomplete (shows customer cards) ────────────────────────────

interface PartyNameInputProps {
  value: string
  onChange: (name: string) => void
  onSelect: (customer: CustomerRecord) => void
}

function PartyNameInput({ value, onChange, onSelect }: PartyNameInputProps): React.ReactElement {
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerRecord[]>([])
  const [focused, setFocused] = useState(false)
  const [highlightedIdx, setHighlightedIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const suppressSearch = useRef(false)

  const showDropdown = focused && customerSuggestions.length > 0

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value
    onChange(v)
    if (!suppressSearch.current) {
      const results = searchCustomers(v, 8)
      setCustomerSuggestions(results)
      setHighlightedIdx(-1)
    }
    suppressSearch.current = false
  }, [onChange])

  const handleSelect = useCallback((customer: CustomerRecord) => {
    suppressSearch.current = true
    onChange(customer.partyName)
    onSelect(customer)
    setCustomerSuggestions([])
    setHighlightedIdx(-1)
    inputRef.current?.blur()
  }, [onChange, onSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIdx(i => Math.min(i + 1, customerSuggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && highlightedIdx >= 0) {
      e.preventDefault()
      handleSelect(customerSuggestions[highlightedIdx])
    } else if (e.key === 'Escape') {
      setCustomerSuggestions([])
      setHighlightedIdx(-1)
    }
  }, [showDropdown, customerSuggestions, highlightedIdx, handleSelect])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setCustomerSuggestions([])
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <span style={{
        position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
        color: focused ? S.accent : S.textMuted,
        pointerEvents: 'none', display: 'flex', alignItems: 'center',
        transition: 'color 0.15s', zIndex: 1,
      }}>
        <User size={15} />
      </span>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Party Name"
        autoComplete="off"
        spellCheck={false}
        style={inputStyle(focused)}
      />

      {value && (
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); onChange(''); setCustomerSuggestions([]) }}
          style={{
            position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
            color: S.textMuted, display: 'flex', alignItems: 'center',
          }}
          tabIndex={-1}
        >
          <X size={13} />
        </button>
      )}

      {/* Customer suggestion dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
            background: S.surfaceRaised,
            border: `1.5px solid ${S.border}`,
            borderRadius: S.radius,
            boxShadow: '0 8px 28px rgba(0,0,0,0.3)',
            zIndex: 100,
            overflow: 'hidden',
            padding: '4px',
          }}
        >
          {customerSuggestions.map((customer, idx) => {
            const highlighted = idx === highlightedIdx
            return (
              <div
                key={customer.id ?? customer.partyName}
                onMouseDown={e => { e.preventDefault(); handleSelect(customer) }}
                onMouseEnter={() => setHighlightedIdx(idx)}
                style={{
                  padding: '10px 14px',
                  background: highlighted ? 'color-mix(in srgb, var(--cq-accent) 12%, transparent)' : 'transparent',
                  cursor: 'pointer',
                  borderRadius: S.radiusSm,
                  transition: 'background 0.1s',
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontSize: '0.875rem', fontWeight: 600,
                    color: highlighted ? S.accent : S.text,
                  }}>
                    {customer.partyName}
                  </span>
                  {customer.phoneNo && (
                    <span style={{ fontSize: '0.75rem', color: S.textMuted, marginLeft: '8px' }}>
                      {customer.phoneNo}
                    </span>
                  )}
                </div>
                {customer.lastTransportName && (
                  <div style={{
                    fontSize: '0.72rem', color: S.textMuted, marginTop: '2px',
                    display: 'flex', alignItems: 'center', gap: '4px',
                  }}>
                    <Truck size={10} />
                    {customer.lastTransportName}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── PartyDetailsSection — main export ───────────────────────────────────────

export function PartyDetailsSection({
  value,
  onChange,
  onCustomerSelect,
}: PartyDetailsSectionProps): React.ReactElement {
  const [extraExpanded, setExtraExpanded] = useState(false)
  const [, setLoading] = useState(true)

  // Load customer and transporter data on mount
  useEffect(() => {
    Promise.all([loadCustomers(), loadTransporters()])
      .finally(() => setLoading(false))
  }, [])

  // Patch a single field
  const patch = useCallback((fields: Partial<PartyDetails>) => {
    onChange({ ...value, ...fields })
  }, [value, onChange])

  // Handle customer selection from autocomplete
  const handleCustomerSelect = useCallback((customer: CustomerRecord) => {
    // Autofill phone and transport from customer record (Hard Spec #17)
    onChange({
      ...value,
      partyName: customer.partyName,
      phone: customer.phoneNo ?? value.phone,
      transportName: customer.lastTransportName ?? value.transportName,
      address: customer.address ?? value.address,
      gstin: customer.gstin ?? value.gstin,
      resolvedCustomerId: customer.id ?? null,
    })
    onCustomerSelect?.(customer)
  }, [value, onChange, onCustomerSelect])

  // Transport fuzzy search (delegates to service)
  const handleTransportSearch = useCallback((query: string) => {
    return searchTransporters(query, 6)
  }, [])

  const handleTransportSelect = useCallback((transportName: string) => {
    patch({ transportName })
  }, [patch])

  return (
    <div style={{
      fontFamily: S.font,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
    }}>
      {/* ── Main fields row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr auto',
        gap: '10px',
        alignItems: 'center',
      }}>
        {/* Party Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: S.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Party Name
          </label>
          <PartyNameInput
            value={value.partyName}
            onChange={name => patch({ partyName: name, resolvedCustomerId: null })}
            onSelect={handleCustomerSelect}
          />
        </div>

        {/* Phone Number */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: S.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Phone
          </label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
              color: S.textMuted, pointerEvents: 'none', display: 'flex',
            }}>
              <Phone size={15} />
            </span>
            <input
              type="tel"
              value={value.phone}
              onChange={e => patch({ phone: e.target.value })}
              placeholder="Phone Number"
              autoComplete="off"
              style={inputStyle(false)}
            />
          </div>
        </div>

        {/* Transport Name */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: S.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Transport
          </label>
          <FuzzyInput
            label="Transport"
            value={value.transportName}
            onChange={v => patch({ transportName: v })}
            onSelect={handleTransportSelect}
            onSearch={handleTransportSearch}
            icon={<Truck size={15} />}
            placeholder="Transport Name"
            renderItem={(item, highlighted) => (
              <span style={{
                fontSize: '0.875rem',
                color: highlighted ? S.accent : S.text,
              }}>
                {item}
              </span>
            )}
          />
        </div>

        {/* Expand / Collapse button */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'transparent', letterSpacing: '0.06em' }}>
            {/* spacer label */}‎
          </label>
          <button
            type="button"
            onClick={() => setExtraExpanded(e => !e)}
            title={extraExpanded ? 'Collapse extra info' : 'Expand extra info (Address, GSTIN, Notes)'}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '9px 14px',
              background: extraExpanded ? 'color-mix(in srgb, var(--cq-accent) 12%, transparent)' : S.surfaceRaised,
              border: `1.5px solid ${extraExpanded ? S.accent : S.border}`,
              borderRadius: S.radius,
              color: extraExpanded ? S.accent : S.textMuted,
              fontSize: '0.8rem', fontWeight: 600, fontFamily: S.font,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 0.15s',
            }}
          >
            {extraExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            <span>More</span>
          </button>
        </div>
      </div>

      {/* ── Expandable Extra Info ── */}
      {extraExpanded && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 180px 1fr',
          gap: '10px',
          padding: '14px 16px',
          background: 'color-mix(in srgb, var(--cq-accent) 4%, var(--cq-surface))',
          border: `1.5px solid ${S.border}`,
          borderRadius: S.radius,
          animation: 'fadeIn 0.15s ease',
        }}>
          {/* Address */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: S.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Address
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '11px', top: '11px',
                color: S.textMuted, pointerEvents: 'none', display: 'flex',
              }}>
                <MapPin size={15} />
              </span>
              <textarea
                value={value.address}
                onChange={e => patch({ address: e.target.value })}
                placeholder="Street, City, State"
                rows={2}
                style={{
                  ...inputStyle(false),
                  padding: '9px 12px 9px 36px',
                  resize: 'none',
                  fontFamily: S.font,
                  lineHeight: '1.5',
                }}
              />
            </div>
          </div>

          {/* GSTIN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: S.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              GSTIN
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
                color: S.textMuted, pointerEvents: 'none', display: 'flex',
              }}>
                <Hash size={15} />
              </span>
              <input
                type="text"
                value={value.gstin}
                onChange={e => patch({ gstin: e.target.value.toUpperCase() })}
                placeholder="29ABCDE1234F1Z5"
                maxLength={15}
                autoComplete="off"
                spellCheck={false}
                style={{
                  ...inputStyle(false),
                  letterSpacing: '0.05em',
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  fontSize: '0.8rem',
                }}
              />
            </div>
          </div>

          {/* Notes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '0.72rem', fontWeight: 600, color: S.textMuted, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              Notes
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: '11px', top: '11px',
                color: S.textMuted, pointerEvents: 'none', display: 'flex',
              }}>
                <FileText size={15} />
              </span>
              <textarea
                value={value.notes}
                onChange={e => patch({ notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
                style={{
                  ...inputStyle(false),
                  padding: '9px 12px 9px 36px',
                  resize: 'none',
                  fontFamily: S.font,
                  lineHeight: '1.5',
                }}
              />
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

export { EMPTY_DETAILS as EMPTY_PARTY_DETAILS }
export default PartyDetailsSection
