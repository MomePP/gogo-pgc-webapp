import Emitter from './emitter'

const OUTPUT_REPORT_ID = 0x00

export class NoDeviceError extends Error {
  constructor(message = 'No device found') {
    super(message)
    this.name = 'NoDeviceError'
    this.message = message
  }
}

// NOTE: rawhid collections used these range of values
//  usage:      0x0100 to 0xFFFF
//  usagePage:  0xFF00 to 0xFFFF
const filterConnectableCollection = (devices) => {
  return devices
    .filter(device => device.collections.length > 0)
    .find(device => device.collections.find(collection => collection.usagePage >= 0xff00))
}

const webhid = {
  isSupported() {
    return !!navigator && !!navigator.hid
  },
  async openDevice(device, handler) {
    Emitter.removeAllListeners('inputreport')

    return device
      .open()
      .then(() => {
        const wrappedHandler = event => {
          if (typeof handler !== 'function') return
          handler(new Uint8Array(event.data.buffer))
        }
        Emitter.addListener('inputreport', wrappedHandler, device)

        const reporter = data => {
          const processedData = new Uint8Array(data.slice(1))
          return device.sendReport(OUTPUT_REPORT_ID, processedData)
        }
        return reporter
      })
      .catch(error => {
        console.error('Error: Cannot open the device', error)
      })
  },
  async connect({
    deviceFilters,
    isPrompt,
    connectHandler,
    disconnectHandler,
    messageHandler
  }) {
    /** Register Events */
    const wrappedConnectHandler = event => {
      /** Discard the device that has empty collections */
      if (event.device.collections.length === 0) return

      const toConnectedDevice = filterConnectableCollection([event.device])
      if (toConnectedDevice === undefined) return

      this.openDevice(toConnectedDevice, messageHandler).then(reporter => {
        connectHandler(reporter)
      })
    }
    Emitter.addListener('connect', wrappedConnectHandler, navigator.hid)

    const wrappedDisconnectHandler = event => {
      if (event.device.opened) {
        disconnectHandler(event)
      }
    }
    Emitter.addListener('disconnect', wrappedDisconnectHandler, navigator.hid)

    let devices = await navigator.hid.getDevices()

    if (devices.length === 0 && isPrompt) {
      devices = await navigator.hid.requestDevice({
        filters: deviceFilters
      })
    }

    const toConnectedDevice = filterConnectableCollection(devices)
    if (devices.length === 0 || toConnectedDevice === undefined) {
      throw new NoDeviceError()
    }

    const reporter = await this.openDevice(toConnectedDevice, messageHandler)
    if (typeof connectHandler === 'function' && reporter) {
      connectHandler(reporter)
    }
    return reporter
  },
  disconnect() {
    /** Unregister all events */
    Emitter.removeAllListeners('inputreport')
    Emitter.removeAllListeners('connect')
    Emitter.removeAllListeners('disconnect')

    return navigator.hid.getDevices().then(devices => {
      for (const device of devices) {
        device.opened && device.close()
      }
    })
  }
}

export default defineNuxtPlugin(() => {
  return {
    provide: {
      webhid
    }
  }
})
