import { useMemo, useState } from "react"
import axios from "axios"
import BigNumber from "bignumber.js"
import { useQuery } from "react-query"
import { useCurrency } from "data/settings/Currency"
import { useExchangeRates } from "data/queries/coingecko"
import { Card } from "components/layout"
import DashboardContent from "../dashboard/components/DashboardContent"
import PoolBreakdownModal from "./components/PoolBreakdownModal"

type Props = {
  chainID: string
}

type CommunityPoolCoin = {
  denom: string
  symbol?: string
  amount: string
}

type CommunityPoolResponse = {
  chainID: string
  type: string
  coins: CommunityPoolCoin[]
  count?: number
}

const formatCompact = (value: number, currencyCode?: string) => {
  if (!Number.isFinite(value)) return "--"

  if (currencyCode) {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currencyCode,
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(value)
  }

  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value)
}

const getCoinLabel = (coin: CommunityPoolCoin, index?: number) => {
  if (
    coin.symbol &&
    coin.symbol !== coin.denom &&
    !coin.symbol.toLowerCase().startsWith("ibc/")
  ) {
    return coin.symbol
  }

  if (coin.denom === "uluna") return "LUNC"
  if (coin.denom === "uusd") return "USTC"

  if (coin.denom.toLowerCase().startsWith("ibc/")) {
    return `IBC Asset ${index !== undefined ? index + 1 : ""}`.trim()
  }

  return coin.denom.toUpperCase()
}

const getCoinValue = (
  coin: CommunityPoolCoin,
  luncPrice: number,
  ustcPrice: number,
) => {
  const amount = new BigNumber(coin.amount || "0")
    .dividedBy(1_000_000)
    .toNumber()

  if (coin.denom === "uluna") return amount * luncPrice
  if (coin.denom === "uusd") return amount * ustcPrice

  return 0
}

const CommunityPool = ({ chainID }: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const selectedCurrency = useCurrency()
  const { data: prices } = useExchangeRates()

  const currencyCode = selectedCurrency?.id || "USD"

  const { data, isLoading, isError } = useQuery<CommunityPoolResponse>(
    ["community-pool", chainID],
    async () => {
      const response = await axios.get(
        "http://localhost:3001/api/pools/community",
        {
          params: { chainID },
        },
      )

      return response.data
    },
    {
      enabled: !!chainID,
      retry: 1,
    },
  )

  const luncPrice = prices?.uluna?.price ?? 0
  const ustcPrice = prices?.uusd?.price ?? 0

  const totalValue = useMemo(() => {
    if (!data?.coins?.length) return 0

    return data.coins.reduce((sum, coin) => {
      return sum + getCoinValue(coin, luncPrice, ustcPrice)
    }, 0)
  }, [data, luncPrice, ustcPrice])

  const luncRow = useMemo(() => {
    return data?.coins?.find((coin) => coin.denom === "uluna") || null
  }, [data])

  const luncAmountDisplay = useMemo(() => {
    if (!luncRow) return "-- LUNC"

    const amount = new BigNumber(luncRow.amount || "0")
      .dividedBy(1_000_000)
      .toNumber()

    return `${formatCompact(amount)} LUNC`
  }, [luncRow])

  const rows = useMemo(() => {
    if (!data?.coins?.length) return []

    return data.coins
      .filter((coin) => !coin.denom.toLowerCase().startsWith("ibc/"))
      .map((coin) => {
        const amount = new BigNumber(coin.amount || "0")
          .dividedBy(1_000_000)
          .toNumber()

        const coinValue = getCoinValue(coin, luncPrice, ustcPrice)
        const label = getCoinLabel(coin)

        return {
          denom: label,
          amount: amount,
          value: coinValue,
          amountDisplay: formatCompact(amount),
          valueDisplay:
            coinValue > 0 ? formatCompact(coinValue, currencyCode) : "-",
        }
      })
  }, [data, luncPrice, ustcPrice, currencyCode])

  return (
    <>
      <Card
        title="Community pool"
        size="small"
        data-chainid={chainID}
        isLoading={isLoading}
        error={isError ? new Error("Failed to load community pool") : undefined}
      >
        <DashboardContent value={formatCompact(totalValue, currencyCode)} />

        <div style={{ marginTop: 8, opacity: 0.7, fontWeight: 700 }}>
          {luncAmountDisplay}
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            marginTop: 18,
            fontWeight: 700,
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "inherit",
          }}
        >
          Show all
        </button>
      </Card>

      <PoolBreakdownModal
        title="Community pool"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        rows={rows}
      />
    </>
  )
}

export default CommunityPool
