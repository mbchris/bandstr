import { computed } from 'vue'
import { useQuasar } from 'quasar'
import { usePlatform } from './usePlatform'

export interface ConfirmDialogOptions {
  title?: string
  message: string
  okLabel?: string
  cancelLabel?: string
  isDestructive?: boolean
  html?: boolean
}

export function useDialog(quasarInstance?: ReturnType<typeof useQuasar>) {
  const { isIos } = usePlatform()

  let qInstance = quasarInstance
  if (!qInstance) {
    try {
      qInstance = useQuasar()
    } catch {
      qInstance = undefined
    }
  }

  const dialogPosition = computed<'bottom' | 'standard'>(() => {
    return isIos.value ? 'bottom' : 'standard'
  })

  function confirmDialog(options: ConfirmDialogOptions) {
    if (!qInstance) {
      return {
        onOk: (fn: () => void) => { fn(); return { onCancel: () => {}, onDismiss: () => {} } },
        onCancel: () => {},
        onDismiss: () => {},
      }
    }

    const isIosPlatform = isIos.value

    return qInstance.dialog({
      title: options.title,
      message: options.message,
      html: options.html ?? false,
      position: isIosPlatform ? 'bottom' : 'standard',
      class: isIosPlatform ? 'ios-action-sheet' : undefined,
      cancel: {
        label: options.cancelLabel || 'Cancel',
        flat: true,
        noCaps: isIosPlatform,
        color: isIosPlatform ? 'grey-8' : undefined,
      },
      ok: {
        label: options.okLabel || 'OK',
        flat: isIosPlatform,
        noCaps: isIosPlatform,
        color: options.isDestructive ? 'negative' : 'primary',
      },
      persistent: false,
    })
  }

  return {
    isIos,
    dialogPosition,
    confirmDialog,
  }
}
