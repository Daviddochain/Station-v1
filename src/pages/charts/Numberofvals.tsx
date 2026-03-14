import React, { useMemo, useState } from "react"
import axios, { AxiosResponse } from "axios"
import BigNumber from "bignumber.js"
import { useQuery } from "react-query"
import { useTranslation } from "react-i18next"
import { Card } from "components/layout"
import DashboardContent from "../dashboard/components/DashboardContent"
import { useNetworks } from "app/InitNetworks"
import { useSelectedDisplayChain } from "utils/localStorage"

type Validator = {
  operator_address?: string
  jailed?: boolean
  status?: string
  tokens?: string
  description?: {
    moniker?: string
  }
}

type ValidatorsResponse = {
  validators?: Validator[]
  pagination?: {
    next_key?: string | null
  }
}

type ValidatorRow = {
  rank: number
  moniker: string
  operator_address: string
  jailed: boolean
  status: string
  tokens: string
  votingPowerPercent: string
}

type ValidatorCountResult = {
  activeCount: number
  validators: ValidatorRow[]
}

type SortColumn = "rank" | "validator" | "votingPower" | "status" | "staked"
type SortDirection = "asc" | "desc"

const BONDED_STATUS = "BOND_STATUS_BONDED"

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontWeight: 700,
  opacity: 0.9,
  cursor: "pointer",
  userSelect: "none",
}

const tdStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "12px 10px",
  borderBottom: "1px solid rgba(255,255,255,0.05)",
  verticalAlign: "middle",
}

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.12)",
  color: "#fff",
  padding: "10px 12px",
  borderRadius: 10,
  outline: "none",
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 16,
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

const formatCompactAmount = (amount: string) => {
  const value = new BigNumber(amount || "0").dividedBy(1_000_000)

  if (value.gte(1_000_000_000_000)) {
    return `${value.dividedBy(1_000_000_000_000).toFixed(2)}T`
  }
  if (value.gte(1_000_000_000)) {
    return `${value.dividedBy(1_000_000_000).toFixed(2)}B`
  }
  if (value.gte(1_000_000)) {
    return `${value.dividedBy(1_000_000).toFixed(2)}M`
  }
  if (value.gte(1_000)) {
    return `${value.dividedBy(1_000).toFixed(2)}K`
  }

  return value.toFixed(2)
}

const ValidatorCount = () => {
  const { t } = useTranslation()
  const title = t("Validators")
  const { networks } = useNetworks()
  const { selectedDisplayChain } = useSelectedDisplayChain()
  const [showAll, setShowAll] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [sortColumn, setSortColumn] = useState<SortColumn>("rank")
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")

  const chainID = selectedDisplayChain || "columbus-5"

  const allNetworks = useMemo(
    () => ({
      ...(networks?.classic ?? {}),
      ...(networks?.mainnet ?? {}),
      ...(networks?.testnet ?? {}),
      ...(networks?.localterra ?? {}),
    }),
    [networks],
  )

  const currentNetwork = allNetworks[chainID]
  const lcd = currentNetwork?.lcd
  const baseDenom = currentNetwork?.baseAsset || "uluna"

  const { data, isLoading, isError } = useQuery<ValidatorCountResult | null>(
    ["validator-count", chainID, lcd],
    async () => {
      if (!lcd) return null

      const base = lcd.replace(/\/$/, "")
      let nextKey: string | null | undefined = null
      const allValidators: Validator[] = []

      do {
        const response: AxiosResponse<ValidatorsResponse> = await axios.get(
          `${base}/cosmos/staking/v1beta1/validators`,
          {
            params: {
              "pagination.limit": 200,
              ...(nextKey ? { "pagination.key": nextKey } : {}),
            },
          },
        )

        allValidators.push(...(response.data?.validators || []))
        nextKey = response.data?.pagination?.next_key
      } while (nextKey)

      const activeValidators = allValidators.filter(
        (validator) =>
          validator.status === BONDED_STATUS && validator.jailed !== true,
      )

      const sortedActive = [...activeValidators].sort((a, b) => {
        const aTokens = Number(a.tokens || 0)
        const bTokens = Number(b.tokens || 0)
        return bTokens - aTokens
      })

      const totalActiveTokens = sortedActive.reduce(
        (sum, validator) => sum.plus(validator.tokens || "0"),
        new BigNumber(0),
      )

      const rows: ValidatorRow[] = sortedActive.map((validator, index) => {
        const tokens = new BigNumber(validator.tokens || "0")
        const votingPowerPercent = totalActiveTokens.gt(0)
          ? tokens.dividedBy(totalActiveTokens).multipliedBy(100).toFixed(2)
          : "0.00"

        return {
          rank: index + 1,
          moniker:
            validator.description?.moniker ||
            validator.operator_address ||
            "Unknown",
          operator_address: validator.operator_address || "",
          jailed: validator.jailed === true,
          status:
            validator.status === BONDED_STATUS && validator.jailed !== true
              ? "Active"
              : "Inactive",
          tokens: validator.tokens || "0",
          votingPowerPercent,
        }
      })

      return {
        activeCount: rows.length,
        validators: rows,
      }
    },
    {
      enabled: !!lcd,
      retry: 1,
    },
  )

  const validatorList = data?.validators || []

  const filteredAndSortedValidators = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()

    const filtered = !term
      ? [...validatorList]
      : validatorList.filter((validator) => {
          const moniker = validator.moniker.toLowerCase()
          const operator = validator.operator_address.toLowerCase()
          return moniker.includes(term) || operator.includes(term)
        })

    filtered.sort((a, b) => {
      let result = 0

      if (sortColumn === "rank") {
        result = a.rank - b.rank
      }

      if (sortColumn === "validator") {
        result = a.moniker.localeCompare(b.moniker)
      }

      if (sortColumn === "votingPower") {
        result =
          parseFloat(a.votingPowerPercent || "0") -
          parseFloat(b.votingPowerPercent || "0")
      }

      if (sortColumn === "status") {
        result = a.status.localeCompare(b.status)
      }

      if (sortColumn === "staked") {
        result = new BigNumber(a.tokens || "0")
          .minus(new BigNumber(b.tokens || "0"))
          .toNumber()
      }

      return sortDirection === "asc" ? result : -result
    })

    return filtered
  }, [validatorList, searchTerm, sortColumn, sortDirection])

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortColumn(column)
      if (column === "validator" || column === "status") {
        setSortDirection("asc")
      } else {
        setSortDirection("desc")
      }
    }
  }

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

  if (isError || !data) return null

  const footer =
    validatorList.length > 0 ? (
      <button
        type="button"
        onClick={() => setShowAll(true)}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          margin: 0,
          font: "inherit",
          cursor: "pointer",
          color: "inherit",
          fontWeight: 700,
        }}
      >
        {t("Show all")}
      </button>
    ) : undefined

  return (
    <>
      <Card title={title} size="small" isLoading={isLoading}>
        <DashboardContent
          value={String(data.activeCount || 0)}
          footer={footer}
        />
      </Card>

      {showAll && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
          onClick={() => setShowAll(false)}
        >
          <div
            style={{
              width: "min(1000px, 95vw)",
              maxHeight: "85vh",
              overflow: "hidden",
              background: "#1f2029",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "18px 22px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
                {title}
              </h2>

              <button
                type="button"
                onClick={() => setShowAll(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#fff",
                  fontSize: 28,
                  lineHeight: 1,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            <div style={{ overflowY: "auto", padding: 20 }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search validator name or operator address"
                style={searchInputStyle}
              />

              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 15,
                }}
              >
                <thead>
                  <tr>
                    <th style={thStyle} onClick={() => toggleSort("rank")}>
                      {renderSortableHeader("#", "rank")}
                    </th>
                    <th style={thStyle} onClick={() => toggleSort("validator")}>
                      {renderSortableHeader("Validator", "validator")}
                    </th>
                    <th
                      style={thStyle}
                      onClick={() => toggleSort("votingPower")}
                    >
                      {renderSortableHeader("Voting Power", "votingPower")}
                    </th>
                    <th style={thStyle} onClick={() => toggleSort("status")}>
                      {renderSortableHeader("Status", "status")}
                    </th>
                    <th style={thStyle} onClick={() => toggleSort("staked")}>
                      {renderSortableHeader(
                        `Staked ${baseDenom === "uluna" ? "LUNC" : baseDenom}`,
                        "staked",
                      )}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredAndSortedValidators.length > 0 ? (
                    filteredAndSortedValidators.map((validator) => (
                      <tr key={validator.operator_address}>
                        <td style={tdStyle}>{validator.rank}</td>
                        <td style={tdStyle}>{validator.moniker}</td>
                        <td style={tdStyle}>{validator.votingPowerPercent}%</td>
                        <td style={tdStyle}>{validator.status}</td>
                        <td style={tdStyle}>
                          {formatCompactAmount(validator.tokens)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        style={{
                          ...tdStyle,
                          color: "rgba(255,255,255,0.75)",
                          fontWeight: 600,
                        }}
                        colSpan={5}
                      >
                        No validators found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ValidatorCount
