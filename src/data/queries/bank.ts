import { useQueries, useQuery } from "react-query"
import createContext from "utils/createContext"
import { queryKey, RefetchOptions } from "../query"
import { useInterchainLCDClient } from "./lcdClient"
import { useInterchainAddresses } from "auth/hooks/useAddress"
import { useCustomTokensCW20 } from "data/settings/CustomTokens"
import { useNetwork } from "data/wallet"
import { getChainIDFromAddress } from "utils/bech32"
import axios from "axios"

const isBrowser = typeof window !== "undefined"

const parseURL = (value?: string) => {
  if (!value) return null

  try {
    return new URL(value)
  } catch {
    return null
  }
}

const isLocalHost = (hostname: string) => {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0"
  )
}

const isAllowedBrowserLCDHost = (hostname: string) => {
  const host = hostname.toLowerCase()

  return (
    host.includes("publicnode.com") ||
    host.includes("terra.dev") ||
    host.includes("lunaclassicstation.com") ||
    host.includes("terra-classic") ||
    host.includes("localhost") ||
    host === "127.0.0.1" ||
    host === "0.0.0.0"
  )
}

const canBrowserCallLCD = (lcd?: string) => {
  const target = parseURL(lcd)
  if (!target) return false
  if (!isBrowser) return true

  const current = parseURL(window.location.origin)
  if (!current) return false

  if (target.origin === current.origin) return true
  if (isLocalHost(target.hostname) && isLocalHost(current.hostname)) return true
  if (isAllowedBrowserLCDHost(target.hostname)) return true

  return false
}

const normalizeCoins = (bal: any) => {
  if (Array.isArray(bal)) {
    return bal[0]?.toArray?.() ?? []
  }

  return bal?.toArray?.() ?? []
}

const fetchClassicBankBalances = async (lcd: string, address: string) => {
  const { data } = await axios.get<{
    balances?: Array<{ denom: string; amount: string }>
  }>(`/cosmos/bank/v1beta1/balances/${address}`, {
    baseURL: lcd,
    timeout: 10000,
  })

  return Array.isArray(data?.balances) ? data.balances : []
}

export interface CoinBalance {
  amount: string
  denom: string
  chain: string
}

export const useInitialTokenBalance = () => {
  const addresses = useInterchainAddresses()
  const networks = useNetwork()
  const lcd = useInterchainLCDClient()
  const { list: cw20 } = useCustomTokensCW20()

  return useQueries(
    cw20.map(({ token }) => {
      const chainID = getChainIDFromAddress(token, networks)
      const address = chainID && addresses?.[chainID]
      const network = chainID ? networks?.[chainID] : undefined
      const enabled =
        !!address && !!network?.lcd && canBrowserCallLCD(network.lcd)

      return {
        queryKey: [queryKey.bank.balances, token, chainID, address],
        queryFn: async () => {
          if (!address) {
            return {
              amount: "0",
              denom: token,
              chain: chainID ?? "",
            } as CoinBalance
          }

          if (!enabled) {
            return {
              amount: "0",
              denom: token,
              chain: chainID ?? "",
            } as CoinBalance
          }

          const { balance } = await lcd.wasm.contractQuery<{ balance: Amount }>(
            token,
            { balance: { address } },
          )

          return {
            amount: balance,
            denom: token,
            chain: chainID ?? "",
          } as CoinBalance
        },
        enabled: !!chainID,
        retry: false,
        refetchOnWindowFocus: false,
        ...RefetchOptions.DEFAULT,
      }
    }),
  )
}

// As a wallet app, native token balance is always required from the beginning.
export const [useBankBalance, BankBalanceProvider] =
  createContext<CoinBalance[]>("useBankBalance")

export const useInitialBankBalance = () => {
  const lcd = useInterchainLCDClient()
  const addresses = useInterchainAddresses()
  const networks = useNetwork()

  return useQueries(
    Object.entries(addresses ?? {}).map(([chainID, address]) => {
      const network = networks?.[chainID]
      const enabled =
        !!address && !!network?.lcd && canBrowserCallLCD(network.lcd)

      return {
        queryKey: [queryKey.bank.balances, address, chainID],
        queryFn: async () => {
          if (!enabled || !network?.lcd) return [] as CoinBalance[]

          if (chainID === "columbus-5") {
            const coins = await fetchClassicBankBalances(network.lcd, address)

            return coins.map(({ denom, amount }) => ({
              denom,
              amount,
              chain: chainID,
            })) as CoinBalance[]
          }

          const bal = ["phoenix-1", "pisco-1"].includes(chainID)
            ? await lcd.bank.spendableBalances(address)
            : await lcd.bank.balance(address)

          const coins = normalizeCoins(bal)

          return coins.map(({ denom, amount }: any) => ({
            denom,
            amount: amount.toString(),
            chain: chainID,
          })) as CoinBalance[]
        },
        enabled: !!address && !!chainID,
        retry: false,
        refetchOnWindowFocus: false,
        ...RefetchOptions.DEFAULT,
      }
    }),
  )
}

export const useBalances = () => {
  const addresses = useInterchainAddresses()
  const lcd = useInterchainLCDClient()
  const networks = useNetwork()

  return useQuery(
    [queryKey.bank.balances, addresses],
    async () => {
      if (!addresses) return [] as CoinBalance[]

      const chains = Object.keys(addresses ?? {})
      const eligibleChains = chains.filter((chain) => {
        const network = networks?.[chain]
        return !!network?.lcd && canBrowserCallLCD(network.lcd)
      })

      if (!eligibleChains.length) return [] as CoinBalance[]

      const balances = await Promise.all(
        eligibleChains.map(async (chain) => {
          const address = addresses[chain]
          const network = networks?.[chain]

          if (chain === "columbus-5" && network?.lcd) {
            return await fetchClassicBankBalances(network.lcd, address)
          }

          return ["phoenix-1", "pisco-1"].includes(chain)
            ? await lcd.bank.spendableBalances(address)
            : await lcd.bank.balance(address)
        }),
      )

      const result = [] as CoinBalance[]

      eligibleChains.forEach((chain, i) => {
        if (chain === "columbus-5") {
          const coins = Array.isArray(balances[i]) ? balances[i] : []

          coins.forEach(({ denom, amount }: any) =>
            result.push({
              denom,
              amount: amount.toString(),
              chain,
            }),
          )

          return
        }

        const coins = normalizeCoins(balances[i])

        coins.forEach(({ denom, amount }: any) =>
          result.push({
            denom,
            amount: amount.toString(),
            chain,
          }),
        )
      })

      return result
    },
    {
      enabled: !!addresses,
      retry: false,
      refetchOnWindowFocus: false,
      ...RefetchOptions.DEFAULT,
    },
  )
}

export const useIsWalletEmpty = () => {
  const bankBalance = useBankBalance()
  return !bankBalance.length
}
