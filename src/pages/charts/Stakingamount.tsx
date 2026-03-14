import { useMemo } from "react"
import axios from "axios"
import BigNumber from "bignumber.js"
import { useQuery } from "react-query"
import { useTranslation } from "react-i18next"
import { Card } from "components/layout"
import { ReadToken } from "components/token"
import DashboardContent from "../dashboard/components/DashboardContent"
import { useNetworks } from "app/InitNetworks"
import { useSelectedDisplayChain } from "utils/localStorage"

type StakingPoolResponse = {
  pool?: {
    bonded_tokens?: string
    not_bonded_tokens?: string
  }
}

type SupplyByDenomResponse = {
  amount?: {
    denom?: string
    amount?: string
  }
}

type SupplyResponse = {
  supply?: Array<{
    denom?: string
    amount?: string
  }>
}

const Stakingamount = () => {
  const { t } = useTranslation()
  const title = t("Staking amount")
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

  const currentNetwork = allNetworks[chainID]
  const lcd = currentNetwork?.lcd
  const baseDenom = currentNetwork?.baseAsset || "uluna"

  const { data, isLoading, isError } = useQuery(
    ["staking-amount", chainID, lcd, baseDenom],
    async () => {
      if (!lcd) return null

      const base = lcd.replace(/\/$/, "")

      const poolRes = await axios.get<StakingPoolResponse>(
        `${base}/cosmos/staking/v1beta1/pool`,
      )

      let supplyAmount = "0"

      try {
        const supplyByDenomRes = await axios.get<SupplyByDenomResponse>(
          `${base}/cosmos/bank/v1beta1/supply/by_denom`,
          {
            params: { denom: baseDenom },
          },
        )

        supplyAmount = supplyByDenomRes.data?.amount?.amount || "0"
      } catch {
        const supplyRes = await axios.get<SupplyResponse>(
          `${base}/cosmos/bank/v1beta1/supply`,
        )

        const matched = supplyRes.data?.supply?.find(
          (item) => item.denom === baseDenom,
        )

        supplyAmount = matched?.amount || "0"
      }

      return {
        pool: poolRes.data?.pool || null,
        supply: supplyAmount,
      }
    },
    {
      enabled: !!lcd,

      retry: 1,
    },
  )

  if (isError) return null
  if (!data?.pool) return null

  const bonded = new BigNumber(data.pool.bonded_tokens || "0")
  const supply = new BigNumber(data.supply || "0")

  if (bonded.lte(0) || supply.lte(0)) return null

  const percent = bonded.dividedBy(supply).multipliedBy(100)

  return (
    <Card
      title={
        <>
          {title}
          <span style={{ marginLeft: 8, opacity: 0.6 }}>
            {percent.toFixed(2)}%
          </span>
        </>
      }
      size="small"
      isLoading={isLoading}
    >
      <DashboardContent
        value={
          <ReadToken amount={bonded.toFixed(0)} denom={baseDenom} prefix />
        }
      />
    </Card>
  )
}

export default Stakingamount
