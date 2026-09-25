// import messages from '@intlify/unplugin-vue-i18n/messages'
import { createI18n } from 'vue-i18n'
// @ts-ignore
import en from '../locales/en.yaml'
// @ts-ignore
import tr from '../locales/tr.yaml'

export const i18n = createI18n({
  legacy: false,
  // Disco Launcher boots in Turkish; useI18nSync applies the user's saved
  // language (Settings > General) as soon as the settings service reports it.
  locale: 'tr',
  fallbackLocale: 'en',
  silentTranslationWarn: true,
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en,
    tr,
  },
})
