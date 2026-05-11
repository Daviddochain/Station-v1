import { Fragment } from "react"
import { useQueries } from "react-query"
import axios from "axios"
import { combineState, queryKey } from "data/query"
import { useNetwork } from "data/wallet"
import { Card, Col, Page } from "components/layout"
import { Empty } from "components/feedback"
import HistoryItem from "./HistoryItem"
import { useInterchainAddresses } from "auth/hooks/useAddress"

interface Props {
  chainID?: string
}

const NON_COSMOS_CHAIN_TYPES = new Set([
  "bitcoin",
  "btc",
  "ethereum",
  "eth",
  "evm",
  "solana",
  "sol"
])

const HISTORY_UNSUPPORTED_LCD_HOSTS = new Set([
  "api.carbon.network",
  "query-api.carbon.network",
  "lcd-axelar.tfl.foundation"
])

const isNonCosmosNetwork = (network?: any) => {
  const chainType = String(network?.chainType ?? "").toLowerCase()

  return (
    NON_COSMOS_CHAIN_TYPES.has(chainType) ||
    network?.chainID === "bitcoin-mainnet" ||
    network?.chainID === "ethereum-mainnet" ||
    network?.chainID === "solana-mainnet" ||
    network?.prefix === "bc" ||
    network?.prefix === "0x" ||
    network?.prefix === "sol"
  )
}

const getLCDHost = (lcd?: string) => {
  if (!lcd) return undefined

  try {
    return new URL(lcd, window.location.origin).hostname
  } catch {
    return undefined
  }
}

const isHistoryBlockedLCD = (lcd?: string) => {
  const host = getLCDHost(lcd)
  return !!host && HISTORY_UNSUPPORTED_LCD_HOSTS.has(host)
}

const canQueryHistory = (network: any, address?: string) => {
  if (!network?.lcd || !address) return false
  if (isNonCosmosNetwork(network)) return false
  if (network.disabledModules?.includes("history")) return false
  if (isHistoryBlockedLCD(network.lcd)) return false

  try {
    new URL(network.lcd, window.location.origin)
  } catch {
    return false
  }

  return true
}

const fetchHistoryEvent = async (
  lcd: string,
  event: string,
  address: string,
  limit: number
) => {
  const query = `${event}='${address}'`

  try {
    return await axios.get<AccountHistory>(`/cosmos/tx/v1beta1/txs`, {
      baseURL: lcd,
      params: {
        query,
        "pagination.limit": limit,
        order_by: "ORDER_BY_DESC"
      }
    })
  } catch {
    return {
      data: {
        tx_responses: [],
        pagination: {
          next_key: null,
          total: "0"
        }
      } as AccountHistory
    }
  }
}

const HistoryList = ({ chainID }: Props) => {
  const addresses = useInterchainAddresses()
  const networks = useNetwork()

  const LIMIT = 75
  const EVENTS = [
    // any tx signed by the user
    "message.sender",
    // any coin received
    "transfer.recipient",
    // any coin sent
    "transfer.sender"
  ]

  const historyData = useQueries(
    Object.keys(addresses ?? {})
      .filter((chain) => !chainID || chain === chainID)
      .filter((chain) => canQueryHistory(networks?.[chain], addresses?.[chain]))
      .map((chain) => {
        const address = chain && addresses?.[chain]

        return {
          queryKey: [queryKey.History, chain, networks?.[chain]?.lcd, address],
          queryFn: async () => {
            const result: any[] = []
            const txhases: string[] = []

            if (!address || !canQueryHistory(networks?.[chain], address)) {
              return result
            }

            const lcd = networks[chain].lcd

            const requests = await Promise.all(
              EVENTS.map((event) =>
                fetchHistoryEvent(lcd, event, address, LIMIT)
              )
            )

            for (const request of requests) {
              const data = request?.data
              const txResponses = Array.isArray(data?.tx_responses)
                ? data.tx_responses
                : []

              txResponses.forEach((tx) => {
                if (!txhases.includes(tx.txhash)) {
                  result.push(tx)
                  txhases.push(tx.txhash)
                }
              })
            }

            return result
              .sort((a, b) => Number(b.height) - Number(a.height))
              .slice(0, LIMIT)
              .map((tx) => ({ ...tx, chain }))
          },
          retry: false,
          refetchOnWindowFocus: false
        }
      })
  )

  const state = combineState(...historyData)
  const history = historyData
    .reduce((acc, { data }) => (data ? [...acc, ...data] : acc), [] as any[])
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
    .slice(0, LIMIT)

  const render = () => {
    if (addresses && !history) return null

    return !history?.length ? (
      <Card>
        <Empty />
      </Card>
    ) : (
      <Col>
        <Fragment>
          {history.map((item) => (
            <HistoryItem {...item} key={item.txhash} />
          ))}
        </Fragment>
      </Col>
    )
  }

  return (
    <Page {...state} invisible>
      {render()}
    </Page>
  )
}

export default HistoryList
