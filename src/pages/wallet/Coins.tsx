import { useTranslation } from "react-i18next"
import { useNativeDenoms } from "data/token"
import { useBankBalance } from "data/queries/bank"
import { useIsWalletEmpty } from "data/queries/bank"
import { Card, Grid } from "components/layout"
import { FormError } from "components/form"
import Asset from "./Asset"

const Coins = () => {
  const { t } = useTranslation()
  const isWalletEmpty = useIsWalletEmpty()
  const readNativeDenom = useNativeDenoms()
  const coins = useBankBalance()

  const render = () => {
    if (!coins) return

    return (
      <>
        <Grid gap={12}>
          {isWalletEmpty && (
            <FormError>{t("Coins required to post transactions")}</FormError>
          )}

          <section>
            {coins.map(({ denom, chain, amount }) => {
              const tokenData = readNativeDenom(denom, chain)

              return (
                <Asset
                  chains={[chain]}
                  denom={denom}
                  balance={amount}
                  {...tokenData}
                  id={[chain, denom].join(":")}
                  key={[chain, denom].join(":")}
                />
              )
            })}
          </section>
        </Grid>
      </>
    )
  }

  return (
    <Card title={t("Coins")}>
      <Grid gap={32}>{render()}</Grid>
    </Card>
  )
}

export default Coins
