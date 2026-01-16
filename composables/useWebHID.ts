import type { WebHIDConnectOptions, WebHIDDevice } from '~/types/webhid'

const webhidConnected = ref(false)
const sendReport = ref<((data: Uint8Array) => Promise<void>) | null>(null)
const notification = ref<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

export const useWebHID = () => {
  const { $webhid } = useNuxtApp()

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    notification.value = { message, type }
    setTimeout(() => notification.value = null, 3000)
  }

  let webhidConnectOptions = {
    deviceFilters: [{ vendorId: 0x0461 }],
    isPrompt: true,
    connectHandler: (reporter: (data: Uint8Array) => Promise<void>) => {
      console.log('WebHID connected:', reporter)
      sendReport.value = reporter
      webhidConnected.value = true
      showNotification('Device connected successfully!')
    },
    disconnectHandler: (event: { device: WebHIDDevice }) => console.log('Disconnected:', event),
    messageHandler: (data: Uint8Array) => {
      // console.log('Message:', data)
    },
  }

  onMounted(async () => {
    if (!webhidConnected.value && $webhid.isSupported()) {
      try {
        await $webhid.connect({ ...webhidConnectOptions, isPrompt: false })
        showNotification('Auto-connected to paired device', 'info')
      } catch (error) {
        console.error('WebHID auto-connect failed:', error)
      }
    }
  })

  return {
    webhidConnected: readonly(webhidConnected),
    sendReport: readonly(sendReport),
    notification: readonly(notification),
    isSupported: (): boolean => $webhid.isSupported(),
    connect: (options?: WebHIDConnectOptions) => $webhid.connect(options || webhidConnectOptions),
    disconnect: (): Promise<void> => $webhid.disconnect(),
    openDevice: (device: WebHIDDevice, handler: (data: Uint8Array) => void) => $webhid.openDevice(device, handler)
  }
}
