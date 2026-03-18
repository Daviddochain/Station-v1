import { useMemo } from "react"
import axios from "axios"
import { useQuery } from "react-query"
import { Card } from "components/layout"
import { useNetworks } from "app/InitNetworks"
import { useSelectedDisplayChain } from "utils/localStorage"

type LatestBlockResponse = {
  block?: {
    header?: {
      height?: string
    }
  }
}

const Blockheight = () => {
  const { networks } = useNetworks()
  const { selectedDisplayChain } = useSelectedDisplayChain()

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

  const currentNetwork = allNetworks?.[chainID]
  const lcd = currentNetwork?.lcd

  const { data, isLoading, error } = useQuery(
    ["blockheight", chainID, lcd],
    async () => {
      if (!lcd) throw new Error("No LCD endpoint found")

      const base = lcd.replace(/\/$/, "")
      const url = `${base}/cosmos/base/tendermint/v1beta1/blocks/latest`

      const response = await axios.get<LatestBlockResponse>(url)
      return response.data?.block?.header?.height ?? "Unknown"
    },
    {
      enabled: !!lcd && !!chainID,
      retry: 1,
      refetchInterval: 6000, // keep it live
    },
  )

  const renderContent = () => {
    if (isLoading) return <div>Loading...</div>
    if (error) return <div>Failed to load block height</div>

    return (
      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          lineHeight: 1.2,
        }}
      >
        {data}
      </div>
    )
  }

  return (
    <Card title="Block height" size="small">
      {renderContent()}
    </Card>
  )
}

export default Blockheight
