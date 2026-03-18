import { useMemo } from "react"
import { useQuery } from "react-query"
import axios, { AxiosError } from "axios"
import BigNumber from "bignumber.js"
import { ValAddress, Validator } from "@terra-money/feather.js"
import { TerraValidator } from "types/validator"
import { TerraProposalItem } from "types/proposal"
import { useNetwork, useChainID } from "data/wallet"
import { queryKey, RefetchOptions } from "../query"
import { useValidators } from "data/queries/staking"

export enum Aggregate {
  PERIODIC = "periodic",
  CUMULATIVE = "cumulative",
}

export enum AggregateStakingReturn {
  DAILY = "daily",
  ANNUALIZED = "annualized",
}

export enum AggregateWallets {
  TOTAL = "total",
  NEW = "new",
  ACTIVE = "active",
}

export const useTerraAPIURL = () => {
  const chainID = useChainID()

  switch (chainID) {
    case "phoenix-1":
      return "https://phoenix-api.terra.dev"
    case "pisco-1":
      return "https://pisco-api.terra.dev"
    default:
      return ""
  }
}

export const useIsTerraAPIAvailable = () => {
  const url = useTerraAPIURL()
  return !!url
}

export const useTerraAPI = <T>(path: string, params?: object, fallback?: T) => {
  const baseURL = useTerraAPIURL()
  const available = useIsTerraAPIAvailable()
  const shouldFallback = !available && fallback !== undefined

  return useQuery<T, AxiosError>(
    [queryKey.TerraAPI, baseURL, path, params],
    async () => {
      if (shouldFallback) return fallback as T
      const { data } = await axios.get(path, { baseURL, params })
      return data
    },
    { ...RefetchOptions.INFINITY, enabled: !!(baseURL || shouldFallback) },
  )
}

/* fee */
export type GasPrices = Record<Denom, Amount>

export const useGasPrices = () => {
  const baseURL = useTerraAPIURL()
  const path = "/gas-prices"

  return useQuery(
    [queryKey.TerraAPI, baseURL, path],
    async () => {
      const { data } = await axios.get<GasPrices>(path, { baseURL })
      return data
    },
    { ...RefetchOptions.INFINITY, enabled: !!baseURL },
  )
}

/* charts */
export enum ChartInterval {
  "1m" = "1m",
  "5m" = "5m",
  "15m" = "15m",
  "30m" = "30m",
  "1h" = "1h",
  "1d" = "1d",
}

export const useLunaPriceChart = (denom: Denom, interval: ChartInterval) => {
  return useTerraAPI<ChartDataItem[]>(`chart/price/${denom}`, { interval })
}

export const useTxVolume = (denom: Denom, type: Aggregate) => {
  return useTerraAPI<ChartDataItem[]>(`chart/tx-volume/${denom}/${type}`)
}

export const useStakingReturn = (type: AggregateStakingReturn) => {
  return useTerraAPI<ChartDataItem[]>(`chart/staking-return/${type}`)
}

export const useTaxRewards = (type: Aggregate) => {
  return useTerraAPI<ChartDataItem[]>(`chart/tax-rewards/${type}`)
}

export const useWallets = (walletsType: AggregateWallets) => {
  return useTerraAPI<ChartDataItem[]>(`chart/wallets/${walletsType}`)
}

export const useSumActiveWallets = () => {
  return useTerraAPI<Record<string, string>>(`chart/wallets/active/sum`)
}

/* validators */
export const useTerraValidators = () => {
  return useTerraAPI<TerraValidator[]>("validators", undefined, [])
}

export const useTerraValidator = (address: ValAddress) => {
  return useTerraAPI<TerraValidator>(`validators/${address}`)
}

export const useTerraProposal = (id: string) => {
  return useTerraAPI<TerraProposalItem[]>(`proposals/${id}`)
}

/* helpers */
export const getCalcVotingPowerRate = (validators: Validator[]) => {
  const total = BigNumber.sum(
    ...validators
      .filter(
        ({ status }) => (status as unknown as string) === "BOND_STATUS_BONDED",
      )
      .map(({ tokens }) => tokens.toString()),
  ).toNumber()

  return (address: ValAddress) => {
    const validator = validators.find(
      ({ operator_address }) => operator_address === address,
    )

    if (!validator) return
    const { tokens, status } = validator
    return (status as unknown as string) === "BOND_STATUS_BONDED"
      ? Number(tokens ?? 0) / total
      : 0
  }
}

export const calcSelfDelegation = (validator?: TerraValidator) => {
  if (!validator) return
  const { self, tokens } = validator
  return self ? Number(self) / Number(tokens) : undefined
}

const getChainIDForValidatorAddress = (
  address: ValAddress,
  networks: Record<string, any>,
) => {
  const prefix = ValAddress.getPrefix(address)
  const matches = Object.values(networks ?? {}).filter(
    (item) => item?.prefix === prefix,
  )

  if (!matches.length) return ""

  if (prefix !== "terra") {
    return matches[0]?.chainID ?? ""
  }

  const classic = matches.find((item) => item?.chainID === "columbus-5")
  if (classic) return classic.chainID

  const phoenix = matches.find((item) => item?.chainID === "phoenix-1")
  if (phoenix) return phoenix.chainID

  return matches[0]?.chainID ?? ""
}

export const useVotingPowerRate = (address: ValAddress) => {
  const networks = useNetwork()
  const chainID = getChainIDForValidatorAddress(address, networks)

  const { data: validators, ...state } = useValidators(chainID)

  const calcRate = useMemo(() => {
    if (!validators) return
    return getCalcVotingPowerRate(validators)
  }, [validators])

  const data = useMemo(() => {
    if (!calcRate) return
    return calcRate(address)
  }, [address, calcRate])

  return { data, ...state }
}
