import { FormError } from "components/form"
import { InternalButton } from "components/general"
import { useBankBalance, useIsWalletEmpty } from "data/queries/bank"
import { useExchangeRates } from "data/queries/coingecko"
import { useNativeDenoms } from "data/token"
import { useMemo } from "react"
import { useTranslation } from "react-i18next"
import ManageTokens from "./ManageTokens"
import Asset from "./Asset"
import styles from "./AssetList.module.scss"
import { useTokenFilters } from "utils/localStorage"
import { toInput } from "txs/utils"
import {
  useCustomTokensCW20,
  useCustomTokensNative,
} from "data/settings/CustomTokens"
import { useIBCBaseDenoms } from "data/queries/ibc"
import { useChainID, useNetwork, useNetworkName } from "data/wallet"
import { ReactComponent as ManageAssets } from "styles/images/icons/ManageAssets.svg"

const MIN_VISIBLE_BALANCE = 0.01

const AssetList = () => {
  const { t } = useTranslation()
  const isWalletEmpty = useIsWalletEmpty()
  const { hideNoWhitelist, hideLowBal } = useTokenFilters()
  const networks = useNetwork()
  const networkName = useNetworkName()
  const activeChainID = useChainID()

  const coins = useBankBalance()
  const { data: prices } = useExchangeRates()
  const readNativeDenom = useNativeDenoms()
  const native = useCustomTokensNative()
  const cw20 = useCustomTokensCW20()

  const alwaysVisibleDenoms = useMemo(
    () =>
      new Set([
        ...cw20.list.map((a) => a.token),
        ...native.list.map((a) => a.denom),
      ]),
    [cw20.list, native.list],
  )

  const unknownIBCDenomsData =
    useIBCBaseDenoms(
      coins
        .map(({ denom, chain }) => ({ denom, chainID: chain }))
        .filter(({ denom, chainID }) => {
          const data = readNativeDenom(denom, chainID)
          return denom.startsWith("ibc/") && data.symbol.endsWith("...")
        }),
    ) ?? []

  const unknownIBCDenoms = unknownIBCDenomsData.reduce(
    (acc, item) => {
      const data = item?.data

      return data
        ? {
            ...acc,
            [[data.ibcDenom, data.chainIDs[data.chainIDs.length - 1]].join(
              "*",
            )]: {
              baseDenom: data.baseDenom,
              chainID: data.chainIDs[0],
              chainIDs: data.chainIDs,
            },
          }
        : acc
    },
    {} as Record<
      string,
      { baseDenom: string; chainID: string; chainIDs: string[] }
    >,
  )

  const list = useMemo(() => {
    const builtList = [
      ...Object.values(
        coins.reduce(
          (acc, { denom, amount, chain }) => {
            const unknownIBCKey = [denom, chain].join("*")
            const resolvedBaseDenom =
              unknownIBCDenoms[unknownIBCKey]?.baseDenom ?? denom
            const resolvedChainID =
              unknownIBCDenoms[unknownIBCKey]?.chainIDs[0] ?? chain

            const data = readNativeDenom(resolvedBaseDenom, resolvedChainID)

            const resolvedAssetChainID =
              unknownIBCDenoms[unknownIBCKey]?.chainIDs[0] ??
              // @ts-expect-error
              data?.chainID ??
              chain

            const key = [resolvedAssetChainID, data.token].join("*")

            if (acc[key]) {
              acc[key].balance = `${
                parseInt(acc[key].balance) + parseInt(amount)
              }`
              acc[key].chains.push(chain)
              return acc
            }

            if (key === "columbus-5*uluna" && networkName !== "classic") {
              return {
                ...acc,
                [key]: {
                  denom: data.token,
                  chainID: resolvedAssetChainID,
                  balance: amount,
                  icon: "https://assets.terra.dev/icon/svg/LUNC.svg",
                  symbol: "LUNC",
                  price: prices?.["uluna:classic"]?.price ?? 0,
                  change: prices?.["uluna:classic"]?.change ?? 0,
                  chains: [chain],
                  id: key,
                  whitelisted: true,
                },
              }
            }

            return {
              ...acc,
              [key]: {
                denom: data.token,
                chainID: resolvedAssetChainID,
                balance: amount,
                icon: data.icon,
                symbol: data.symbol,
                price: prices?.[data.token]?.price ?? 0,
                change: prices?.[data.token]?.change ?? 0,
                chains: [chain],
                id: key,
                whitelisted: !(
                  data.isNonWhitelisted ||
                  unknownIBCDenoms[unknownIBCKey]?.chainIDs.find(
                    (c) => !networks[c],
                  )
                ),
              },
            }
          },
          {} as Record<string, any>,
        ) ?? {},
      ),
    ]

    const activeNetwork = activeChainID ? networks?.[activeChainID] : undefined
    const activeBaseAsset = activeNetwork?.baseAsset

    if (activeChainID && activeBaseAsset) {
      const baseData = readNativeDenom(activeBaseAsset, activeChainID)
      const activeKey = `${activeChainID}*${baseData.token}`

      const alreadyExists = builtList.find((item) => item.id === activeKey)

      if (!alreadyExists) {
        builtList.unshift({
          denom: baseData.token,
          chainID: activeChainID,
          balance: "0",
          icon: baseData.icon,
          symbol: baseData.symbol,
          price: prices?.[baseData.token]?.price ?? 0,
          change: prices?.[baseData.token]?.change ?? 0,
          chains: [activeChainID],
          id: activeKey,
          whitelisted: true,
        })
      }
    }

    return builtList
      .filter((a) => (hideNoWhitelist ? a.whitelisted : true))
      .filter((a) => {
        const chainID = a.id?.split("*")?.[0]
        const { token, decimals } = readNativeDenom(a.denom, chainID)

        const humanBalance = Number(toInput(a.balance, decimals ?? 6))

        if (humanBalance > MIN_VISIBLE_BALANCE) {
          return true
        }

        if (
          activeChainID &&
          chainID === activeChainID &&
          a.denom === networks?.[activeChainID]?.baseAsset
        ) {
          return true
        }

        if (!hideLowBal || a.price === 0 || alwaysVisibleDenoms.has(token)) {
          return true
        }

        return a.price * humanBalance >= 1
      })
      .sort((a, b) => {
        const chainIDA = a.id?.split("*")?.[0]
        const chainIDB = b.id?.split("*")?.[0]

        const decimalsA = readNativeDenom(a.denom, chainIDA).decimals ?? 6
        const decimalsB = readNativeDenom(b.denom, chainIDB).decimals ?? 6

        const balanceA = Number(toInput(a.balance, decimalsA))
        const balanceB = Number(toInput(b.balance, decimalsB))

        return b.price * balanceB - a.price * balanceA
      })
  }, [
    coins,
    readNativeDenom,
    prices,
    hideNoWhitelist,
    hideLowBal,
    alwaysVisibleDenoms,
    unknownIBCDenoms,
    networks,
    networkName,
    activeChainID,
  ])

  const render = () => {
    if (!coins) return

    return (
      <div>
        {isWalletEmpty && (
          <FormError>{t("Coins required to post transactions")}</FormError>
        )}
        <section>
          {list.map(({ denom, chainID, id, ...item }, i) => (
            <Asset
              denom={denom}
              {...readNativeDenom(
                unknownIBCDenoms[[denom, chainID].join("*")]?.baseDenom ??
                  denom,
                unknownIBCDenoms[[denom, chainID].join("*")]?.chainID ??
                  chainID,
              )}
              id={id}
              {...item}
              key={i}
            />
          ))}
        </section>
      </div>
    )
  }

  return (
    <article className={styles.assetlist}>
      <div className={styles.assetlist__title}>
        <h3>Assets</h3>
        <ManageTokens>
          {(open) => (
            <InternalButton className={styles.manage__button} onClick={open}>
              {t("Manage")}
              <ManageAssets />
            </InternalButton>
          )}
        </ManageTokens>
      </div>
      <div className={styles.assetlist__list}>{render()}</div>
    </article>
  )
}

export default AssetList
