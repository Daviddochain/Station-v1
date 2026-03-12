import { useMemo } from "react"
import { WithFetching } from "components/feedback"
import { Read, ReadToken, TokenIcon } from "components/token"
import { useExchangeRates } from "data/queries/coingecko"
import { useCurrency } from "data/settings/Currency"
import { useNetwork, useNetworkName } from "data/wallet"
import { useTranslation } from "react-i18next"
import styles from "./AssetChain.module.scss"
import IbcSendBack from "./IbcSendBack"
import { CopyIcon, InternalButton } from "components/general"
import { Tooltip } from "components/display"
import { useDevMode } from "utils/localStorage"
import { truncate } from "@terra-money/terra-utils"
import { useNetworks } from "app/InitNetworks"

export interface Props {
  chain: string
  balance: string
  symbol: string
  token: string
  denom: string
  path?: string[]
  ibcDenom?: string
  decimals?: number
}

const AssetChain = (props: Props) => {
  const { chain, symbol, balance, token, path, ibcDenom, denom, decimals } =
    props
  const currency = useCurrency()
  const { data: prices, ...pricesState } = useExchangeRates()
  const { t } = useTranslation()
  const networkName = useNetworkName()
  const allNetworks = useNetworks().networks[networkName]

  const networks = useNetwork()
  const { devMode } = useDevMode()

  const { icon, name } = allNetworks[chain] ?? { name: chain }

  const resolvedPriceEntry = useMemo(() => {
    if (!prices) return undefined

    return (
      (symbol === "LUNC" ? prices["uluna:classic"] : undefined) ??
      (symbol === "LUNA" ? prices["uluna:phoenix"] : undefined) ??
      (denom === "uluna" && networkName === "classic"
        ? prices["uluna:classic"]
        : undefined) ??
      (denom === "uluna" && networkName !== "classic"
        ? prices["uluna:phoenix"]
        : undefined) ??
      prices[denom] ??
      prices[token] ??
      prices[symbol?.toLowerCase?.() ?? ""] ??
      prices[`${denom}:classic`] ??
      prices[`${denom}:phoenix`]
    )
  }, [prices, denom, token, symbol, networkName])

  const price = Number(resolvedPriceEntry?.price ?? 0)

  const normalizedBalance = Number(balance ?? "0") / Math.pow(10, decimals ?? 6)

  const walletValue = price * normalizedBalance

  const displayFixed =
    walletValue > 0 && walletValue < 0.01
      ? 8
      : walletValue >= 0.01 && walletValue < 1
        ? 4
        : 2

  // send back is not available if one of the chains the asset went through is not supported by Station
  const isSendBackDisabled =
    !!path?.find((chain) => !networks[chain]) ||
    (symbol === "LUNC" && networkName !== "classic")

  return (
    <article className={styles.chain} key={name}>
      <TokenIcon token={name} icon={icon} size={28} />
      <section className={styles.details}>
        <div className={styles.name}>
          <h4>
            {name}
            {ibcDenom &&
              path &&
              (isSendBackDisabled ? (
                <Tooltip
                  content={
                    <article>
                      <p>
                        {t(
                          "This asset originates from an unsupported chain and cannot be sent back.",
                        )}
                      </p>
                    </article>
                  }
                >
                  <p className={styles.send__back__button__disabled}>
                    {t("Send back")}
                  </p>
                </Tooltip>
              ) : (
                <IbcSendBack
                  chainID={chain}
                  token={ibcDenom}
                  title={`Send ${symbol} back to ${
                    allNetworks[path[0]]?.name ?? path[0]
                  }`}
                >
                  {(open) => (
                    <InternalButton
                      onClick={() => !isSendBackDisabled && open()}
                      className={styles.send__back__button}
                      disabled={isSendBackDisabled}
                    >
                      {t("Send back")}
                    </InternalButton>
                  )}
                </IbcSendBack>
              ))}
          </h4>

          {path && (
            <p>{path.map((c) => allNetworks[c]?.name ?? c).join(" → ")}</p>
          )}

          {devMode && (
            <p>
              <span className={styles.copy__denom}>
                {truncate(denom)}
                <CopyIcon text={denom} size={14} />
              </span>
            </p>
          )}
        </div>

        <h1 className={styles.price}>
          {currency.symbol}{" "}
          {price > 0 ? (
            <Read
              amount={walletValue}
              decimals={0}
              fixed={displayFixed}
              denom=""
            />
          ) : (
            <span>—</span>
          )}
        </h1>

        <h2 className={styles.amount}>
          <WithFetching {...pricesState} height={1}>
            {(progress, wrong) => (
              <>
                {progress}
                {wrong ? (
                  <span className="danger">{t("Failed to query balance")}</span>
                ) : (
                  <ReadToken
                    hideDenom
                    denom={denom}
                    decimals={decimals}
                    amount={balance}
                    fixed={2}
                  />
                )}
              </>
            )}
          </WithFetching>{" "}
          {symbol}
        </h2>
      </section>
    </article>
  )
}

export default AssetChain
