import { AccAddress } from "@terra-money/feather.js"
import { getChainNamefromID } from "data/queries/chains"
import { useNetwork, useAddress } from "data/wallet"
import { TokenIcon } from "components/token"
import { useInterchainAddresses } from "auth/hooks/useAddress"
import { Table } from "components/layout"
import styles from "./AddressTable.module.scss"
import { useTranslation } from "react-i18next"
import WithSearchInput from "pages/custom/WithSearchInput"
import AddressBox from "components/form/AddressBox"
import { useBankBalance } from "data/queries/bank"

interface Props {
  finderLink?: boolean
  className?: string
}

const AddressTable = (props: Props) => {
  const { finderLink, className } = props
  const addresses = useInterchainAddresses() as {
    [key: string]: AccAddress
  }

  const isConnected = useAddress()
  const networks = useNetwork()
  const { t } = useTranslation()
  const coins = useBankBalance()

  const NotConnected = () => (
    <p className={styles.connect}>
      {t("Connect a wallet to see your addresses")}
    </p>
  )

  if (!isConnected) return <NotConnected />

  // ✅ Build address list safely
  const addressData = Object.keys(addresses ?? {})
    .map((key) => {
      const network = networks?.[key]

      return {
        address: addresses[key],
        chainName: getChainNamefromID(key, networks) ?? key,
        id: key,
        hasBalance: coins.some(({ chain }) => chain === key),
        icon: network?.icon,
        baseAsset: network?.baseAsset,
      }
    })
    .sort((a, b) => {
      // ✅ First: chains WITH balance
      if (a.hasBalance && !b.hasBalance) return -1
      if (!a.hasBalance && b.hasBalance) return 1

      // ✅ Then alphabetical
      return a.chainName.localeCompare(b.chainName)
    })

  return (
    <WithSearchInput
      gap={10}
      placeholder={t("Search for a chain...")}
      className={styles.grid__override}
    >
      {(keyword: string) => (
        <Table
          className={className}
          size="small"
          bordered
          dataSource={addressData}
          filter={({ chainName }) => {
            if (!keyword) return true
            return chainName.toLowerCase().includes(keyword.toLowerCase())
          }}
          columns={[
            {
              dataIndex: "chainName",
              align: "left",
              render: (_: string, { id, chainName, icon, baseAsset }) => (
                <div className={styles.chain}>
                  <TokenIcon token={baseAsset} icon={icon} />
                  <div className={styles.name}>{chainName}</div>
                </div>
              ),
            },
            {
              hidden: finderLink,
              dataIndex: "address",
              render: (address: AccAddress) => (
                <AddressBox withQR address={address} />
              ),
            },
          ]}
        />
      )}
    </WithSearchInput>
  )
}

export default AddressTable
