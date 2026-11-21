import { useEffect, useState, type RefObject } from 'react'

interface DeviceHints extends Navigator {
  deviceMemory?: number
  connection?: { saveData?: boolean }
}

function supportsWebGL() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: true })
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  } catch {
    return false
  }
}

export function useSceneAvailability(container: RefObject<HTMLElement | null>) {
  const [enabled, setEnabled] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const element = container.current
    if (!element) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const device: DeviceHints = navigator
    const limited =
      device.connection?.saveData || (device.deviceMemory ?? 8) <= 2 || (device.hardwareConcurrency || 8) <= 2
    let inView = false
    let supported: boolean | undefined

    function update() {
      const onScreen = inView && !document.hidden
      setVisible(onScreen)
      if (motion.matches || limited) {
        setEnabled(false)
      } else if (onScreen) {
        supported ??= supportsWebGL()
        setEnabled(supported)
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      update()
    })
    observer.observe(element)
    motion.addEventListener('change', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      observer.disconnect()
      motion.removeEventListener('change', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [container])

  return { enabled, visible }
}
