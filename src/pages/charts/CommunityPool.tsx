import { useMemo, useState } from "react"
import axios from "axios"
import BigNumber from "bignumber.js"
import { useQuery } from "react-query"
import { useCurrency } from "data/settings/Currency"
import { useExchangeRates } from "data/queries/coingecko"
import { Card } from "components/layout"
import DashboardContent from "../dashboard/components/DashboardContent"
import PoolBreakdownModal from "./components/PoolBreakdownModal"
import { useNativeDenoms } from "data/token"

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

const CommunityPool = ({ chainID }: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const selectedCurrency = useCurrency()
  const { data: prices } = useExchangeRates()
  const readNativeDenom = useNativeDenoms()

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

  const getCoinLabel = (coin: CommunityPoolCoin, index?: number) => {
    const native = readNativeDenom(coin.denom, chainID)

    if (
      coin.symbol &&
      coin.symbol !== coin.denom &&
      !coin.symbol.toLowerCase().startsWith("ibc/")
    ) {
      return coin.symbol
    }

    if (native?.symbol && native.symbol !== coin.denom) {
      return native.symbol
    }

    if (coin.denom.toLowerCase().startsWith("ibc/")) {
      return `IBC Asset ${index !== undefined ? index + 1 : ""}`.trim()
    }

    return coin.denom.toUpperCase()
  }

  const getCoinAmount = (coin: CommunityPoolCoin) => {
    const decimals = readNativeDenom(coin.denom, chainID).decimals ?? 6

    return new BigNumber(coin.amount || "0")
      .dividedBy(new BigNumber(10).pow(decimals))
      .toNumber()
  }

  const getCoinPrice = (coin: CommunityPoolCoin) => {
    const native = readNativeDenom(coin.denom, chainID)
    const symbol = native?.symbol

    return (
      (symbol === "LUNC" ? prices?.["uluna:classic"]?.price : undefined) ??
      (symbol === "LUNA" ? prices?.["uluna:phoenix"]?.price : undefined) ??
      prices?.[`${chainID}:${coin.denom}`]?.price ??
      prices?.[coin.denom]?.price ??
      prices?.[native?.token ?? ""]?.price ??
      prices?.[symbol?.toLowerCase?.() ?? ""]?.price ??
      0
    )
  }

  const totalValue = useMemo(() => {
    if (!data?.coins?.length) return 0

    return data.coins.reduce((sum, coin) => {
      return sum + getCoinAmount(coin) * getCoinPrice(coin)
    }, 0)
  }, [data, prices, chainID])

  const primaryRow = useMemo(() => {
    if (!data?.coins?.length) return null

    return (
      [...data.coins]
        .filter((coin) => !coin.denom.toLowerCase().startsWith("ibc/"))
        .sort((a, b) => {
          const aValue = getCoinAmount(a) * getCoinPrice(a)
          const bValue = getCoinAmount(b) * getCoinPrice(b)
          return bValue - aValue
        })[0] || null
    )
  }, [data, prices, chainID])

  const primaryAmountDisplay = useMemo(() => {
    if (!primaryRow) return "--"

    const amount = getCoinAmount(primaryRow)
    return `${formatCompact(amount)} ${getCoinLabel(primaryRow)}`
  }, [primaryRow, chainID])

  const rows = useMemo(() => {
    if (!data?.coins?.length) return []

    return data.coins
      .filter((coin) => !coin.denom.toLowerCase().startsWith("ibc/"))
      .map((coin, index) => {
        const amount = getCoinAmount(coin)
        const coinValue = amount * getCoinPrice(coin)
        const label = getCoinLabel(coin, index)

        return {
          denom: label,
          amount,
          value: coinValue,
          amountDisplay: formatCompact(amount),
          valueDisplay:
            coinValue > 0 ? formatCompact(coinValue, currencyCode) : "-",
        }
      })
  }, [data, prices, chainID, currencyCode])

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
          {primaryAmountDisplay}
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
