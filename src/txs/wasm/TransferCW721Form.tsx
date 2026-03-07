import { useCallback, useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useForm } from "react-hook-form"
import PersonIcon from "@mui/icons-material/Person"
import { AccAddress, MsgExecuteContract } from "@terra-money/feather.js"
import { truncate } from "@terra-money/terra-utils"
import { SAMPLE_ADDRESS } from "config/constants"
import { queryKey } from "data/query"
import { useNetwork } from "data/wallet"
import { useTnsAddress } from "data/external/tns"
import { Auto, Card, InlineFlex } from "components/layout"
import { Form, FormItem, FormHelp, Input } from "components/form"
import NFTAssetItem from "pages/nft/NFTAssetItem"
import AddressBookList from "../AddressBook/AddressBookList"
import validate from "../validate"
import Tx from "../Tx"
import { getChainIDFromAddress } from "utils/bech32"
import { useInterchainAddresses } from "auth/hooks/useAddress"

interface AddressBook {
  recipient: string
  memo?: string
}

interface TxValues {
  recipient: string
  address: string
  memo: string
}

interface Props {
  contract: string
  id: string
}

const TransferCW721Form = ({ contract, id }: Props) => {
  const { t } = useTranslation()
  const addresses = useInterchainAddresses()
  const network = useNetwork()
  const chainID = getChainIDFromAddress(contract, network) ?? ""
  const connectedAddress = addresses?.[chainID]

  const form = useForm<TxValues>({
    mode: "onChange",
    defaultValues: {
      recipient: "",
      address: "",
      memo: "",
    },
  })

  const {
    register,
    trigger,
    watch,
    setValue,
    setError,
    clearErrors,
    handleSubmit,
    formState: { errors },
  } = form

  const { recipient, memo } = watch()

  const onClickAddressBookItem = async ({ recipient, memo }: AddressBook) => {
    setValue("recipient", recipient, {
      shouldValidate: true,
      shouldDirty: true,
    })
    setValue("memo", memo ?? "", { shouldDirty: true })
    await trigger("recipient")
  }

  const { data: resolvedAddress, ...tnsState } = useTnsAddress(recipient)

  useEffect(() => {
    if (!recipient) {
      setValue("address", "", { shouldValidate: false })
      clearErrors("recipient")
    } else if (AccAddress.validate(recipient)) {
      setValue("address", recipient, { shouldValidate: false })
      clearErrors("recipient")
    } else if (resolvedAddress) {
      setValue("address", resolvedAddress, { shouldValidate: false })
      clearErrors("recipient")
    } else {
      setValue("address", "", { shouldValidate: false })
    }
  }, [recipient, resolvedAddress, setValue, clearErrors])

  const invalid: string | false =
    recipient.endsWith(".ust") && !tnsState.isLoading && !resolvedAddress
      ? t("Address not found")
      : false

  const disabled: string | false =
    invalid || (tnsState.isLoading ? t("Searching for address...") : false)

  useEffect(() => {
    if (invalid) {
      setError("recipient", { type: "invalid", message: invalid })
    }
  }, [invalid, setError])

  const createTx = useCallback(
    ({ address, memo }: TxValues) => {
      if (!connectedAddress) return
      if (!address || !AccAddress.validate(address)) return

      const msgs = [
        new MsgExecuteContract(connectedAddress, contract, {
          transfer_nft: { recipient: address, token_id: id },
        }),
      ]

      return { msgs, memo, chainID }
    },
    [connectedAddress, contract, id, chainID],
  )

  const estimationTxValues = useMemo(
    () => ({
      recipient: connectedAddress ?? "",
      address: connectedAddress ?? "",
      memo: "",
    }),
    [connectedAddress],
  )

  const tx = {
    estimationTxValues,
    createTx,
    disabled,
    queryKeys: [
      [
        queryKey.wasm.contractQuery,
        contract,
        { tokens: { owner: connectedAddress } },
      ],
    ],
    chain: chainID,
  }

  const renderResolvedAddress = () => {
    if (!resolvedAddress) return null

    return (
      <InlineFlex gap={4} className="success">
        <PersonIcon fontSize="inherit" />
        {truncate(resolvedAddress)}
      </InlineFlex>
    )
  }

  return (
    <Auto
      columns={[
        <Card isFetching={tnsState.isLoading}>
          <NFTAssetItem contract={contract} id={id} />

          <Tx {...tx}>
            {({ fee, submit }) => (
              <Form onSubmit={handleSubmit(submit.fn)}>
                <FormItem
                  label={t("Recipient")}
                  extra={renderResolvedAddress()}
                  error={errors.recipient?.message}
                >
                  <Input
                    {...register("recipient", {
                      required: t("Recipient is required"),
                      validate: validate.recipient(),
                    })}
                    placeholder={SAMPLE_ADDRESS}
                    autoFocus
                  />

                  <input {...register("address")} readOnly hidden />
                </FormItem>

                <FormItem
                  label={`${t("Memo")} (${t("optional")})`}
                  error={errors.memo?.message}
                >
                  <Input
                    {...register("memo", {
                      validate: {
                        size: validate.size(256, "Memo"),
                        brackets: validate.memo(),
                      },
                    })}
                  />
                </FormItem>

                {fee.render()}

                {!memo && (
                  <FormHelp>
                    {t("Check if this transaction requires a memo")}
                  </FormHelp>
                )}

                {submit.button}
              </Form>
            )}
          </Tx>
        </Card>,
        <AddressBookList onClick={onClickAddressBookItem} />,
      ]}
    />
  )
}

export default TransferCW721Form
