import { useTranslation } from "react-i18next"
import { AccAddress, Validator, ValAddress } from "@terra-money/feather.js"
import { FinderLink } from "components/general"
import { Card, Grid } from "components/layout"
import { ValidatorNumber } from "./components/ValidatorNumbers"
import styles from "./ValidatorAddresses.module.scss"

const ValidatorAddresses = ({ validator }: { validator: Validator }) => {
  const { t } = useTranslation()

  const { operator_address } = validator

  // ✅ FIX: derive correct prefix for ANY chain (LUNC, LUNA, Dungeon, etc.)
  const walletAddress = AccAddress.fromValAddress(
    ValAddress.fromString(operator_address),
  )

  const addresses = [
    {
      title: t("Operator address"),
      content: <FinderLink validator>{operator_address}</FinderLink>,
    },
    {
      title: t("Wallet address"),
      content: <FinderLink>{walletAddress}</FinderLink>,
    },
  ]

  return (
    <Card title={t("Addresses")} bordered twoTone>
      <Grid gap={12} className={styles.addresses}>
        {addresses.map((item) => (
          <ValidatorNumber {...item} key={item.title} />
        ))}
      </Grid>
    </Card>
  )
}

export default ValidatorAddresses
