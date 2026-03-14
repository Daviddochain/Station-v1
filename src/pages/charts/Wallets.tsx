import { useMemo, useState } from "react"
import axios from "axios"
import { useQuery } from "react-query"
import { useTranslation } from "react-i18next"
import { Card } from "components/layout"
import { TooltipIcon } from "components/display"
import { Select } from "components/form"
import DashboardContent from "../dashboard/components/DashboardContent"
import Filter from "./components/Filter"

type Props = {
  chainID: string
}

type ActiveWalletsResponse = {
  chainID: string
  hours: number
  active_wallets: number
  sampled_blocks: number
  sampled_txs: number
  decoded_txs: number
  unique_wallets_in_sample: number
  wallet_density_per_tx: number
  note: string
}

const formatNumberValue = (value: number | string | null | undefined) => {
  if (value === null || value === undefined || value === "") return "-"
  const num = Number(value)
  if (Number.isNaN(num)) return "-"
  return new Intl.NumberFormat("en-US").format(num)
}

const ActiveWallets = ({ chainID }: Props) => {
  const { t } = useTranslation()
  const [hours, setHours] = useState(24)

  const { data, isLoading, isError } = useQuery<ActiveWalletsResponse>(
    ["active-wallets", chainID, hours],
    async () => {
      const response = await axios.get(
        "http://localhost:3001/api/wallets/active",
        {
          params: { chainID, hours },
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
    return formatNumberValue(data?.active_wallets)
  }, [data])

  const footer = useMemo(() => {
    if (!data) return null

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div>
          <strong>Sampled blocks:</strong>{" "}
          {formatNumberValue(data.sampled_blocks)}
        </div>
        <div>
          <strong>Sampled txs:</strong> {formatNumberValue(data.sampled_txs)}
        </div>
        <div>
          <strong>Decoded txs:</strong> {formatNumberValue(data.decoded_txs)}
        </div>
        <div>
          <strong>Unique wallets in sample:</strong>{" "}
          {formatNumberValue(data.unique_wallets_in_sample)}
        </div>
        <div>
          <strong>Wallet density / tx:</strong>{" "}
          {data.wallet_density_per_tx?.toFixed(4) ?? "-"}
        </div>
      </div>
    )
  }, [data])

  return (
    <Card
      isLoading={isLoading}
      error={isError ? new Error("Failed to load active wallets") : undefined}
      title={
        <TooltipIcon
          content={t(
            "Estimated active wallets based on unique deduplicated addresses found in sampled decoded transactions.",
          )}
        >
          {t("Active wallets")}
        </TooltipIcon>
      }
      extra={
        <Filter>
          <Select
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            small
          >
            <option value={24}>24h</option>
            <option value={24 * 7}>7d</option>
            <option value={24 * 30}>30d</option>
          </Select>
        </Filter>
      }
      size="small"
      data-chainid={chainID}
    >
      <DashboardContent value={value} footer={footer} />
    </Card>
  )
}

export default ActiveWallets
