import { useDateString } from './date'

/**
 * Disco: the single place that turns instance playtime and last-played values
 * into the strings every surface shows (tooltip detail panel, dashboard hero
 * card, instance extensions). Before this, the header extension, the tooltip
 * panel and the dashboard each had their own copy, which is why one fact could
 * read "4.31 gün", "4 gün 7 saat" and "3 gün 23 saat 10 dakika" at the same
 * time. Formats here:
 *   playtime    -> "X gün Y saat" (minutes alone when both are zero)
 *   last played -> relative ("35 dakika önce"), full timestamp in a tooltip
 */

export function useInstanceFacts() {
  const { t } = useI18n()
  const { getDateString } = useDateString()

  /** Playtime as "X gün Y saat"; "X saat Y dakika" under a day. */
  function formatPlayTime(ms: number) {
    if (!ms) return t('instance.neverPlayed')
    const totalMinutes = Math.floor(ms / 60000)
    const days = Math.floor(totalMinutes / 1440)
    const hours = Math.floor((totalMinutes % 1440) / 60)
    const minutes = totalMinutes % 60
    if (days > 0) {
      return t('duration.day', { duration: days }, { plural: days }) + ' ' + t('duration.hour', { duration: hours }, { plural: hours })
    }
    if (hours > 0) {
      return t('duration.hour', { duration: hours }, { plural: hours }) + ' ' + t('duration.minute', { duration: minutes }, { plural: minutes })
    }
    return t('duration.minute', { duration: minutes }, { plural: minutes })
  }

  /** Last played as a relative string, with the full timestamp for tooltips. */
  function formatLastPlayed(ms: number) {
    if (!ms) return { text: t('instance.neverPlayed'), full: '' }
    return { text: getDateString(ms), full: new Date(ms).toLocaleString() }
  }

  return { formatPlayTime, formatLastPlayed }
}