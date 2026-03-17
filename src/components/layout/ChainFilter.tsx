import classNames from "classnames"
import { useChainID, useNetworkWithFeature } from "data/wallet"
import { useState, memo, useMemo, useRef, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import styles from "./ChainFilter.module.scss"
import { useSavedChain } from "utils/localStorage"
import { isTerraChain } from "utils/chain"
import { OtherChainsButton } from "components/layout"
import { useSortedDisplayChains } from "utils/chain"
import { useDisplayChains } from "utils/localStorage"
import { ChainFeature } from "types/chains"

type Props = {
  children: (chain?: string) => React.ReactNode
  all?: boolean
  outside?: boolean
  title?: string
  className?: string
  terraOnly?: boolean
  feature?: ChainFeature
}

const cx = classNames.bind(styles)

const ChainFilter = ({
  children,
  all,
  outside,
  title,
  className,
  terraOnly,
  feature,
}: Props) => {
  const { t } = useTranslation()
  const { savedChain, changeSavedChain } = useSavedChain()
  const [width, setWidth] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const network = useNetworkWithFeature(feature)
  const chainID = useChainID()
  const { displayChains } = useDisplayChains()
  const sortedDisplayChains = useSortedDisplayChains()

  const measureWidth = useCallback(() => {
    if (!ref.current) return
    setWidth(ref.current.offsetWidth)
  }, [])

  useEffect(() => {
    measureWidth()
    window.addEventListener("resize", measureWidth)
    return () => window.removeEventListener("resize", measureWidth)
  }, [measureWidth])

  const networks = useMemo(
    () =>
      sortedDisplayChains
        .map((id) => network[id])
        .filter(
          (n): n is NonNullable<typeof n> =>
            !!n && !!displayChains?.includes(n.chainID),
        ),
    [network, sortedDisplayChains, displayChains],
  )

  const initNetwork =
    network[savedChain ?? ""]?.chainID ?? (all ? undefined : chainID)

  const [selectedChain, setChain] = useState<string | undefined>(initNetwork)

  let fixedChain: string | undefined
  if (terraOnly) {
    fixedChain = chainID
  } else if (selectedChain && network[selectedChain]) {
    fixedChain = selectedChain
  } else {
    fixedChain = all ? undefined : chainID
  }

  const getUIWidth = useCallback((networkName: string) => {
    if (!ref.current || !networkName) return 0

    const container = document.createElement("button")
    container.style.gap = "0.5rem"
    container.style.minWidth = "4rem"
    container.style.border = "var(--border-width) solid var(--card-border)"
    container.style.borderRadius = "1rem"
    container.style.padding = "0.1rem 1rem"
    container.style.color = "var(--text-muted)"
    container.style.boxShadow = "inset 0px 0px 0 0.5px var(--card-border)"
    container.style.opacity = "0.75"
    container.innerHTML = networkName

    ref.current.appendChild(container)
    const textWidth = container.offsetWidth
    ref.current.removeChild(container)

    const insideGap = 8
    const imageWidth = 18
    const outsideGap = 6.4
    return textWidth + insideGap + outsideGap + imageWidth
  }, [])

  const displayChainMax = useMemo(() => {
    let count = 0
    let calculatedWidth = all ? 80 : 0
    const chainOverflowWidth = 80
    const chainNameList: string[] = []

    for (let i = 0; i < networks.length; i++) {
      const fullWidth = getUIWidth(networks[i].name)
      calculatedWidth += fullWidth

      if (width - chainOverflowWidth > calculatedWidth) {
        chainNameList.push(networks[i].chainID)
        count++
      } else {
        break
      }
    }

    return { count, chainNameList }
  }, [all, networks, width, getUIWidth])

  const networksToShow = useMemo(() => {
    let toShow = [] as typeof networks
    const { count, chainNameList } = displayChainMax

    if (terraOnly) {
      toShow = Object.values(network ?? {}).filter((n) =>
        isTerraChain(n.prefix),
      )
    } else if (fixedChain) {
      toShow = [...networks.slice(0, count)]

      if (!chainNameList.includes(fixedChain) && network[fixedChain]) {
        toShow = [
          ...networks.slice(0, Math.max(0, count - 1)),
          network[fixedChain],
        ]
      }
    } else {
      toShow = networks.slice(0, count)
    }

    return Array.from(new Map(toShow.map((n) => [n.chainID, n])).values())
  }, [networks, network, terraOnly, displayChainMax, fixedChain])

  const otherNetworks = useMemo(
    () =>
      Object.values(network ?? {}).filter(
        (n) => !networksToShow.some((shown) => shown.chainID === n.chainID),
      ),
    [network, networksToShow],
  )

  const handleSetChain = useCallback(
    (chain: string | undefined) => {
      setChain(chain)
      changeSavedChain(chain)
    },
    [changeSavedChain],
  )

  useEffect(() => {
    if (selectedChain !== undefined && network[selectedChain] === undefined) {
      handleSetChain(all ? undefined : chainID)
    }
  }, [selectedChain, network, handleSetChain, all, chainID])

  return (
    <div className={outside ? styles.chainfilter__out : styles.chainfilter}>
      <div
        className={cx(className, styles.header, terraOnly ? styles.swap : "")}
      >
        {title && <h1>{title}</h1>}
        <div className={styles.pills} ref={ref}>
          {all && (
            <button
              onClick={() => handleSetChain(undefined)}
              className={cx(
                styles.all,
                styles.button,
                fixedChain ? undefined : styles.active,
              )}
            >
              {t("All")}
            </button>
          )}

          {networksToShow.map((c) => (
            <button
              key={c.chainID}
              onClick={() => handleSetChain(c.chainID)}
              className={cx(
                styles.button,
                fixedChain === c.chainID ? styles.active : undefined,
              )}
            >
              <img src={c.icon} alt={c.name} />
              {c.name}
            </button>
          ))}

          {!terraOnly && otherNetworks.length > 0 && (
            <OtherChainsButton
              handleSetChain={handleSetChain}
              list={otherNetworks}
            />
          )}
        </div>
      </div>
      <div className={styles.content}>{children(fixedChain)}</div>
    </div>
  )
}

export default memo(ChainFilter)
