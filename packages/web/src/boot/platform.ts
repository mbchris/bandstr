import { boot } from 'quasar/wrappers'
import { Capacitor } from '@capacitor/core'
import ioniconsV4 from 'quasar/icon-set/ionicons-v4'

export default boot(({ app }) => {
  const isIos = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
  if (isIos && app.config.globalProperties.$q?.iconSet) {
    app.config.globalProperties.$q.iconSet.set(ioniconsV4)
  }
})
