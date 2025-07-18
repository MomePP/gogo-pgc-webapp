class Emitter {
  constructor() {
    this.listeners = new Map()
  }

  addListener(label, callback, vm) {
    if (typeof callback === 'function') {
      this.listeners.has(label) || this.listeners.set(label, [])
      this.listeners.get(label).push({ callback, vm })
      vm.addEventListener(label, callback)
      return true
    }
    return false
  }

  removeAllListeners(label) {
    const listeners = this.listeners.get(label)
    if (!listeners || listeners.length === 0) return

    for (const listener of listeners) {
      try {
        listener.vm.removeEventListener(label, listener.callback)
      } catch (error) {
        console.error('Error: remove event listeners', error)
      }
    }
    this.listeners.delete(label)
  }

  removeListener(label, callback, vm) {
    const listeners = this.listeners.get(label)
    let index

    if (listeners && listeners.length) {
      index = listeners.reduce((i, listener, index) => {
        if (typeof listener.callback === 'function' && listener.callback === callback && listener.vm === vm) {
          i = index
        }
        return i
      }, -1)

      if (index > -1) {
        listeners.splice(index, 1)
        this.listeners.set(label, listeners)
        return true
      }
    }
    return false
  }

  emit(label, ...args) {
    const listeners = this.listeners.get(label)

    if (listeners && listeners.length) {
      listeners.forEach((listener) => {
        listener.callback.call(listener.vm, ...args)
      })
      return true
    }
    return false
  }
}

export default new Emitter()
