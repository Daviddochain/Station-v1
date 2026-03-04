import BluetoothTransport from "@ledgerhq/hw-transport-web-ble"
import { LEDGER_TRANSPORT_TIMEOUT } from "config/constants"
import is from "auth/scripts/is"

export async function isBleAvailable() {
  const n: any = navigator
  return n?.bluetooth && (await n.bluetooth.getAvailability())
}

export async function createBleTransport() {
  return await BluetoothTransport.create(LEDGER_TRANSPORT_TIMEOUT)
}
