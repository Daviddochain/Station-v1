import { useQueries, useQuery } from "react-query"
import axios from "axios"
import { queryKey } from "../query"

interface NetworkItem {
  chainID: string
  lcd: string
}

interface BankBalancesResponse {
  balances?: Array<{
    denom: string
    amount: string
  }>
  pagination?: {
    next_key?: string | null
    total?: string
  }
}

interface LCDValidationResult {
  valid: boolean
  url: string
}

const TEST_ADDRESS_BY_PREFIX: Record<string, string> = {
  terra: "terra1skjwj5whet0lpe65qaq4rpq03hjxlwd9d9m5zk",
  osmo: "osmo1y2yy3q583kuysxzg3jyg9qughkugnp5g3zygzxyzs6ygrlyj39yq0cykz3",
  cosmos: "cosmos1l55g32yvgj8g3zpa3zpmvg4az4jg0qux3zy93c5cy2yg4rhy3w5qzm8704",
  juno: "juno1nzvgsky9269c3ru2shm0fpvyew9g3zytwdug3pvx3zyx35huns0s0ynvjg",
  stars: "stars13cuc3jyvmr5g0zrcs7ydhz8c8z5gmp3c3zygsaug3zy93zygxdesmygvp8",
  axelar: "axelar13qwg0zyg3zug3zyg3pvrtzrcmtvgfzqaj6rv3qux3z37384c3z5qh6wvzc",
  migaloo: "migaloo13zyg3zygmz593rhctzvgazv7s4laskz33zycsxq6y4vg37zcmzyqdk4xk2",
  mars: "mars13c5gmjyy3zy83zyzlzyv0y5gs4v8mryg3qv7s6yg0zypt4593z9qe6fyca",
  chihuahua:
    "chihuahua13zyg8rkc325g3zqc30cc4pygsky23regs2pg3pygzt5gsswclzyqf4q5q4",
  orai: "orai1sjy03zzg3pyg0zvg3f3hdr5p2wy93zyg3zr5hrygezyg3zyvsduqh9meyx",
  archway: "archway19zyg89yr3q6clxrchz9wrzyc6h2y3z8gs7y93zygs6ytdzypgjyq6rd8j5",
  inj: "inj19p5g3zycswyg35n0suvgs3vg8x8g0p7c32ygs6eg3pv9ekygsjpqrfgwx7",
  celestia:
    "celestia1v2ygthvgrzlrdzxtz5wc3e9csjygvafjxx5wfzypskdgdpwcsx8qla8932",
  neutron: "neutron13zqu8yug3zygdzygswygslug3zd5hzpr5jygh69gs7vgmzvzs7yqan9rag",
  stafi: "stafi1hzpc3p3glzzcdrvg3zyfhz5gh7yxsvhcakygvkygsj9cduu73lksdf03dm",
}

const getPrefixFromChain = (chainID: string) => {
  if (!chainID) return ""

  const lower = chainID.toLowerCase()

  if (lower.includes("osmosis")) return "osmo"
  if (lower.includes("cosmos")) return "cosmos"
  if (lower.includes("juno")) return "juno"
  if (lower.includes("stargaze")) return "stars"
  if (lower.includes("axelar")) return "axelar"
  if (lower.includes("migaloo")) return "migaloo"
  if (lower.includes("mars")) return "mars"
  if (lower.includes("chihuahua")) return "chihuahua"
  if (lower.includes("orai")) return "orai"
  if (lower.includes("archway")) return "archway"
  if (lower.includes("injective")) return "inj"
  if (lower.includes("celestia")) return "celestia"
  if (lower.includes("neutron")) return "neutron"
  if (lower.includes("stafihub")) return "stafi"
  if (lower.includes("terra")) return "terra"

  return ""
}

const getTestAddress = (chainID: string) => {
  const prefix = getPrefixFromChain(chainID)
  return TEST_ADDRESS_BY_PREFIX[prefix] ?? ""
}

const isSuccessStatus = (status?: number) => {
  return typeof status === "number" && status >= 200 && status < 300
}

const validateNetworkRequest = async (network?: NetworkItem) => {
  if (!network?.lcd || !network?.chainID) return null

  const address = getTestAddress(network.chainID)
  if (!address) return null

  try {
    const response = await axios.get<BankBalancesResponse>(
      `${network.lcd}/cosmos/bank/v1beta1/balances/${address}`,
      {
        timeout: 8000,
      },
    )

    const status = response?.status

    if (!isSuccessStatus(status)) {
      console.warn(
        `Network validation returned non-success for ${network.chainID}:`,
        {
          lcd: network.lcd,
          status,
        },
      )
      return null
    }

    return network.chainID
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      console.warn(`Network validation failed for ${network.chainID}:`, {
        lcd: network.lcd,
        message: error.message,
        status: error.response?.status,
        code: error.code,
      })
    } else if (error instanceof Error) {
      console.warn(`Network validation failed for ${network.chainID}:`, {
        lcd: network.lcd,
        message: error.message,
      })
    } else {
      console.warn(`Network validation failed for ${network.chainID}:`, {
        lcd: network.lcd,
        message: String(error),
      })
    }

    return null
  }
}

export const useValidNetwork = (network?: NetworkItem) => {
  return useQuery(
    [queryKey.tendermint.nodeInfo, network?.chainID, network?.lcd],
    () => validateNetworkRequest(network),
    {
      enabled: !!network?.lcd && !!network?.chainID,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    },
  )
}

export const useValidNetworks = (networks: NetworkItem[] = []) => {
  return useQueries(
    networks.map((network) => ({
      queryKey: [queryKey.tendermint.nodeInfo, network?.chainID, network?.lcd],
      queryFn: () => validateNetworkRequest(network),
      enabled: !!network?.lcd && !!network?.chainID,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      cacheTime: 10 * 60 * 1000,
    })),
  )
}

export const useValidateLCD = (lcd?: string) => {
  return useQuery<LCDValidationResult>(
    [queryKey.tendermint.nodeInfo, "custom-lcd", lcd],
    async () => {
      if (!lcd) {
        return {
          valid: false,
          url: "",
        }
      }

      try {
        const response = await axios.get(
          `${lcd}/cosmos/base/tendermint/v1beta1/node_info`,
          {
            timeout: 8000,
          },
        )

        const status = response?.status

        return {
          valid: isSuccessStatus(status),
          url: lcd,
        }
      } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
          console.warn("Custom LCD validation failed:", {
            lcd,
            message: error.message,
            status: error.response?.status,
            code: error.code,
          })
        } else if (error instanceof Error) {
          console.warn("Custom LCD validation failed:", {
            lcd,
            message: error.message,
          })
        } else {
          console.warn("Custom LCD validation failed:", {
            lcd,
            message: String(error),
          })
        }

        return {
          valid: false,
          url: lcd,
        }
      }
    },
    {
      enabled: !!lcd,
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 60 * 1000,
      cacheTime: 5 * 60 * 1000,
    },
  )
}
