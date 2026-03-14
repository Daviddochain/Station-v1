import { useMemo } from "react"
import axios from "axios"
import { useQuery } from "react-query"
import { useTranslation } from "react-i18next"
import { Card } from "components/layout"
import { TooltipIcon } from "components/display"
import DashboardContent from "../dashboard/components/DashboardContent"

type Props = {
  chainID: string
}

type VolumeResponse = {
  chainID: string
  name: string
  symbol: string
  price: number | null
  volume_24h: number | null
  market_cap: number | null
  percent_change_24h: number | null
  last_updated: string | null
}

const formatUsdCompact = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value)
}

const formatUsdPrice = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(value)) return "-"

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 6,
    maximumFractionDigits: 10,
  }).format(value)
}

const TxVolume = ({ chainID }: Props) => {
  const { t } = useTranslation()

  const { data, isLoading, isError } = useQuery<VolumeResponse>(
    ["cmc-current-volume", chainID],
    async () => {
      const response = await axios.get(
        "http://localhost:3001/api/cmc/volume/current",
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

  const value = useMemo(() => {
    return formatUsdCompact(data?.volume_24h)
  }, [data])

  const footer = useMemo(() => {
    if (!data) return null

    const change = data.percent_change_24h

    const changeColor =
      change === null || change === undefined
        ? "inherit"
        : change >= 0
          ? "#4caf50"
          : "#ff4d4f"

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div>
          <strong>Symbol:</strong> {data.symbol}
        </div>

        <div>
          <strong>Price:</strong> {formatUsdPrice(data.price)}
        </div>

        <div>
          <strong>24h Change:</strong>{" "}
          <span style={{ color: changeColor, fontWeight: 600 }}>
            {change !== null && change !== undefined
              ? `${change.toFixed(2)}%`
              : "-"}
          </span>
        </div>
      </div>
    )
  }, [data])

  return (
    <Card
      isLoading={isLoading}
      error={
        isError
          ? new Error("Failed to load current off-chain volume")
          : undefined
      }
      title={
        <TooltipIcon
          content={t(
            "Current 24 hour off-chain trading volume from CoinMarketCap.",
          )}
        >
          {t("Off Chain Transaction volume")}
        </TooltipIcon>
      }
      size="small"
      data-chainid={chainID}
    >
      <DashboardContent value={value} footer={footer} />
    </Card>
  )
}

export default TxVolume
