import { Fragment } from "react"
import { useQueries } from "react-query"
import axios from "axios"
import { combineState, queryKey } from "data/query"
import { useNetwork } from "data/wallet"
import { Card, Col, Page } from "components/layout"
import { Empty } from "components/feedback"
import HistoryItem from "./HistoryItem"
import { useInterchainAddresses } from "auth/hooks/useAddress"
import { isTerraChain } from "utils/chain"

interface Props {
  chainID?: string
}

interface PaginationKeys {
  limit: string
  offset: string
  reverse: string
}

/**
 * Returns pagination keys for the given chain. Switched by cosmos_sdk
 * version in the future, isTerra for now.
 *
 * @param isTerra boolean based on chain-id. True if Terra, false if not.
 */
function getPaginationKeys(isTerra: boolean): PaginationKeys {
  if (isTerra) {
    return {
      limit: "limit",
      offset: "page",
      reverse: "orderBy",
    }
  } else {
    return {
      limit: "pagination.limit",
      offset: "pagination.offset",
      reverse: "pagination.reverse",
    }
  }
}

const HistoryList = ({ chainID }: Props) => {
  const addresses = useInterchainAddresses()
  const networks = useNetwork()

  const LIMIT = 75
  const EVENTS = ["message.sender", "transfer.recipient", "transfer.sender"]

  const historyData = useQueries(
    Object.keys(addresses ?? {})
      .filter((chain) => !chainID || chain === chainID)
      .map((chain) => {
        const address = chain && addresses?.[chain]
        const isTerra = isTerraChain(chain)
        const paginationKeys = getPaginationKeys(isTerra)

        return {
          queryKey: [queryKey.History, networks?.[chain]?.lcd, address],
          queryFn: async () => {
            const result: any[] = []
            const txhases: string[] = []

            if (!networks?.[chain]?.lcd || !address) {
              return result
            }

            const lcd = networks[chain].lcd

            // Temporary guard:
            // Axelar LCD history calls are failing in the browser due to CORS.
            // For now, return empty history for Axelar instead of spamming errors.
            if (
              chain === "axelar-dojo-1" ||
              lcd.includes("lcd-axelar.tfl.foundation")
            ) {
              return result
            }

            const requests = await Promise.all(
              EVENTS.map((event) =>
                axios
                  .get<AccountHistory>(`/cosmos/tx/v1beta1/txs`, {
                    baseURL: lcd,
                    params: {
                      events: `${event}='${address}'`,
                      [paginationKeys.offset]: 0 || undefined,
                      [paginationKeys.reverse]: isTerra ? 2 : true,
                      [paginationKeys.limit]: LIMIT,
                    },
                  })
                  .catch(() => ({
                    data: {
                      tx_responses: [],
                      pagination: {
                        next_key: null,
                        total: "0",
                      },
                    } as unknown as AccountHistory,
                  })),
              ),
            )

            for (const { data } of requests) {
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
        }
      }),
  )

  const state = combineState(...historyData)
  const history = historyData
    .reduce((acc, { data }) => (data ? [...acc, ...data] : acc), [] as any[])
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
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
