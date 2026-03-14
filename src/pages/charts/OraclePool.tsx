import { useMemo, useState } from "react"
import axios from "axios"
import BigNumber from "bignumber.js"
import { useQuery } from "react-query"
import { useCurrency } from "data/settings/Currency"
import { useExchangeRates } from "data/queries/coingecko"
import { Card } from "components/layout"
import DashboardContent from "../dashboard/components/DashboardContent"
import PoolBreakdownModal from "../charts/components/PoolBreakdownModal"
import { useSelectedDisplayChain } from "utils/localStorage"

type OraclePoolCoin = {
  denom: string
  symbol?: string
  amount: string
}

type OraclePoolResponse = {
  chainID: string
  type: string
  address?: string
  coins: OraclePoolCoin[]
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

const isIbcCoin = (coin: OraclePoolCoin) => {
  return coin.denom.toLowerCase().startsWith("ibc/")
}

const getCoinLabel = (coin: OraclePoolCoin) => {
  if (
    coin.symbol &&
    coin.symbol !== coin.denom &&
    !coin.symbol.toLowerCase().startsWith("ibc/")
  ) {
    return coin.symbol
  }

  if (coin.denom === "uluna") return "LUNC"
  if (coin.denom === "uusd") return "USTC"

  return coin.denom.toUpperCase()
}

const getCoinAmount = (coin: OraclePoolCoin) => {
  return new BigNumber(coin.amount || "0").dividedBy(1_000_000).toNumber()
}

const getCoinValue = (
  coin: OraclePoolCoin,
  luncPrice: number,
  ustcPrice: number,
) => {
  const amount = getCoinAmount(coin)

  if (coin.denom === "uluna") return amount * luncPrice
  if (coin.denom === "uusd") return amount * ustcPrice

  return 0
}

const OraclePool = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const selectedCurrency = useCurrency()
  const { data: prices } = useExchangeRates()
  const { selectedDisplayChain } = useSelectedDisplayChain()

  const chainID = selectedDisplayChain || "columbus-5"
  const currencyCode = selectedCurrency?.id || "USD"

  const { data, isLoading, isError } = useQuery<OraclePoolResponse>(
    ["oracle-pool", chainID],
    async () => {
      const response = await axios.get(
        "http://localhost:3001/api/pools/oracle",
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

  const filteredCoins = useMemo(() => {
    if (!data?.coins?.length) return []
    return data.coins.filter((coin) => !isIbcCoin(coin))
  }, [data])

  const totalValue = useMemo(() => {
    if (!filteredCoins.length) return 0

    return filteredCoins.reduce((sum, coin) => {
      return sum + getCoinValue(coin, luncPrice, ustcPrice)
    }, 0)
  }, [filteredCoins, luncPrice, ustcPrice])

  const luncRow = useMemo(() => {
    return filteredCoins.find((coin) => coin.denom === "uluna") || null
  }, [filteredCoins])

  const luncAmountDisplay = useMemo(() => {
    if (!luncRow) return "-- LUNC"

    const amount = getCoinAmount(luncRow)
    return `${formatCompact(amount)} LUNC`
  }, [luncRow])

  const rows = useMemo(() => {
    if (!filteredCoins.length) return []

    return filteredCoins.map((coin) => {
      const amount = getCoinAmount(coin)
      const coinValue = getCoinValue(coin, luncPrice, ustcPrice)

      return {
        denom: getCoinLabel(coin),
        amount,
        value: coinValue,
        amountDisplay: formatCompact(amount),
        valueDisplay:
          coinValue > 0 ? formatCompact(coinValue, currencyCode) : "-",
      }
    })
  }, [filteredCoins, luncPrice, ustcPrice, currencyCode])

  return (
    <>
      <Card
        title="Oracle pool"
        size="small"
        isLoading={isLoading}
        error={isError ? new Error("Failed to load oracle pool") : undefined}
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
        title="Oracle pool"
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        rows={rows}
      />
    </>
  )
}

export default OraclePool
