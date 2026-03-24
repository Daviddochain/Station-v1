import { useMemo } from "react"
import { useNetworks } from "app/InitNetworks"
import classNames from "classnames/bind"
import Flex from "./Flex"
import styles from "./SettingsSelector.module.scss"
import { STATION_ASSETS } from "config/constants"

const cx = classNames.bind(styles)

interface Props {
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  withSearch?: boolean
  withToggle?: boolean
}

const resolveIconSrc = (icon?: string) => {
  if (!icon) return ""

  if (icon.startsWith("http://") || icon.startsWith("https://")) {
    return icon
  }

  if (icon.startsWith("/")) {
    return `${STATION_ASSETS}${icon}`
  }

  return `${STATION_ASSETS}/${icon}`
}

const SettingsSelector = ({ value, options, onChange }: Props) => {
  const selected = value
  const { networks } = useNetworks()

  const allNetworks = useMemo(
    () => ({
      ...(networks?.mainnet ?? {}),
      ...(networks?.classic ?? {}),
      ...(networks?.testnet ?? {}),
      ...(networks?.localterra ?? {}),
    }),
    [networks],
  )

  return (
    <div className={styles.wrapper}>
      <section className={styles.selector}>
        {options.map(({ value, label }) => {
          const network = allNetworks[value]
          const iconSrc = resolveIconSrc(network?.icon)

          return (
            <div className={styles.accordion} key={value}>
              <button
                className={styles.item}
                onClick={() => onChange(value)}
                type="button"
              >
                <div className={styles.icons_container}>
                  <div className={styles.network}>
                    {iconSrc && (
                      <img src={iconSrc} alt={network?.name ?? label} />
                    )}
                    {label}
                  </div>
                </div>

                <Flex className={styles.track}>
                  <span
                    className={cx(styles.indicator, {
                      checked: selected === value,
                    })}
                  />
                </Flex>
              </button>
            </div>
          )
        })}
      </section>
    </div>
  )
}

export default SettingsSelector
