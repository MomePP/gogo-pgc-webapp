import type { WebHIDConnectOptions, WebHIDDevice } from '~/types/webhid'

export const useWebHID = () => {
  const { $webhid } = useNuxtApp()

  return {
    isSupported: (): boolean => $webhid.isSupported(),
    connect: (options: WebHIDConnectOptions) => $webhid.connect(options),
    disconnect: (): Promise<void> => $webhid.disconnect(),
    openDevice: (device: WebHIDDevice, handler: (data: Uint8Array) => void) => $webhid.openDevice(device, handler)
  }
}
