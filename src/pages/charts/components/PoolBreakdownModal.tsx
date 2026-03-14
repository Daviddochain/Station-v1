import React, { useMemo, useState } from "react"

type PoolRow = {
  denom: string
  amount?: number
  value?: number
  amountDisplay: string
  valueDisplay?: string
}

type Props = {
  title: string
  isOpen: boolean
  onClose: () => void
  rows: PoolRow[]
}

type SortColumn = "coin" | "amount" | "value"
type SortDirection = "asc" | "desc"

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0, 0, 0, 0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "24px",
}

const modalStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "1000px",
  maxHeight: "85vh",
  overflow: "hidden",
  background: "#1f2230",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "20px",
  boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
  display: "flex",
  flexDirection: "column",
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "20px 24px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
}

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "20px",
  fontWeight: 800,
  color: "#fff",
}

const closeButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: "34px",
  lineHeight: 1,
  cursor: "pointer",
}

const bodyStyle: React.CSSProperties = {
  padding: "8px 20px 20px",
  overflowY: "auto",
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  color: "rgba(255,255,255,0.7)",
  fontSize: "13px",
  fontWeight: 700,
  padding: "14px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  cursor: "pointer",
  userSelect: "none",
}

const tdStyle: React.CSSProperties = {
  color: "#fff",
  fontSize: "15px",
  fontWeight: 700,
  padding: "14px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.06)",
}

const emptyStyle: React.CSSProperties = {
  color: "rgba(255,255,255,0.75)",
  padding: "24px 10px",
  fontWeight: 600,
}

const headerContentStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
}

const arrowsWrapStyle: React.CSSProperties = {
  display: "inline-flex",
  flexDirection: "column",
  lineHeight: 0.8,
  marginLeft: "2px",
}

const PoolBreakdownModal = ({ title, isOpen, onClose, rows }: Props) => {
  const [sortColumn, setSortColumn] = useState<SortColumn>("value")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("desc")
    }
  }

  const sortedRows = useMemo(() => {
    const data = [...rows]

    data.sort((a, b) => {
      let result = 0

      if (sortColumn === "coin") {
        result = a.denom.localeCompare(b.denom)
      }

      if (sortColumn === "amount") {
        result = (a.amount ?? 0) - (b.amount ?? 0)
      }

      if (sortColumn === "value") {
        result = (a.value ?? 0) - (b.value ?? 0)
      }

      return sortDirection === "asc" ? result : -result
    })

    return data
  }, [rows, sortColumn, sortDirection])

  const renderSortableHeader = (label: string, column: SortColumn) => {
    const isActive = sortColumn === column
    const upActive = isActive && sortDirection === "asc"
    const downActive = isActive && sortDirection === "desc"

    return (
      <span style={headerContentStyle}>
        {label}
        <span style={arrowsWrapStyle}>
          <span
            style={{
              fontSize: 9,
              color: upActive ? "#ffffff" : "rgba(255,255,255,0.35)",
              transform: "translateY(1px)",
            }}
          >
            ▲
          </span>
          <span
            style={{
              fontSize: 9,
              color: downActive ? "#ffffff" : "rgba(255,255,255,0.35)",
              transform: "translateY(-1px)",
            }}
          >
            ▼
          </span>
        </span>
      </span>
    )
  }

  if (!isOpen) return null

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h2 style={titleStyle}>{title}</h2>
          <button type="button" style={closeButtonStyle} onClick={onClose}>
            ×
          </button>
        </div>

        <div style={bodyStyle}>
          {rows.length === 0 ? (
            <div style={emptyStyle}>No pool breakdown data available yet.</div>
          ) : (
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>#</th>

                  <th style={thStyle} onClick={() => toggleSort("coin")}>
                    {renderSortableHeader("Coin", "coin")}
                  </th>

                  <th style={thStyle} onClick={() => toggleSort("amount")}>
                    {renderSortableHeader("Amount", "amount")}
                  </th>

                  <th style={thStyle} onClick={() => toggleSort("value")}>
                    {renderSortableHeader("Value", "value")}
                  </th>
                </tr>
              </thead>

              <tbody>
                {sortedRows.map((row, index) => (
                  <tr key={`${row.denom}-${index}`}>
                    <td style={tdStyle}>{index + 1}</td>
                    <td style={tdStyle}>{row.denom}</td>
                    <td style={tdStyle}>{row.amountDisplay}</td>
                    <td style={tdStyle}>{row.valueDisplay || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

export default PoolBreakdownModal
