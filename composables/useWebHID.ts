import type { WebHIDConnectOptions, WebHIDDevice } from '~/types/webhid'

const webhidConnected = ref(false)
const sendReport = ref<((data: Uint8Array) => Promise<void>) | null>(null)

export const useWebHID = () => {
  const { $webhid } = useNuxtApp()

  let webhidConnectOptions = {
    deviceFilters: [{ vendorId: 0x0461 }],
    isPrompt: true,
    connectHandler: (reporter: (data: Uint8Array) => Promise<void>) => {
      console.log('Connected:', reporter)
      sendReport.value = reporter
      webhidConnected.value = true
    },
    disconnectHandler: (event: { device: WebHIDDevice }) => console.log('Disconnected:', event),
    messageHandler: (data: Uint8Array) => {
      // console.log('Message:', data)
    },
  }

  return {
    webhidConnected: readonly(webhidConnected),
    sendReport: readonly(sendReport),
    isSupported: (): boolean => $webhid.isSupported(),
    connect: (options?: WebHIDConnectOptions) => $webhid.connect(options || webhidConnectOptions),
    disconnect: (): Promise<void> => $webhid.disconnect(),
    openDevice: (device: WebHIDDevice, handler: (data: Uint8Array) => void) => $webhid.openDevice(device, handler)
  }
}
