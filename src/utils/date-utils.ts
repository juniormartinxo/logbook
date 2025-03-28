import { parseISO, startOfDay, endOfDay, format } from 'date-fns'
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

// Timezone do Brasil (Brasília)
const TIMEZONE = 'America/Sao_Paulo'

/**
 * Converte uma string de data para um objeto Date considerando o timezone brasileiro
 */
export function parseDateWithTimezone(dateString: string): Date {
    const parsedDate = parseISO(dateString)
    return fromZonedTime(parsedDate, TIMEZONE)
}

/**
 * Retorna o início do dia para uma data, ajustando para o timezone brasileiro
 */
export function startOfDayWithTimezone(date: Date): Date {
    // Converte para o timezone local
    const zonedDate = toZonedTime(date, TIMEZONE)
    // Pega o início do dia nesse timezone
    const startDay = startOfDay(zonedDate)
    // Converte de volta para UTC para trabalhar com APIs
    return fromZonedTime(startDay, TIMEZONE)
}

/**
 * Retorna o fim do dia para uma data, ajustando para o timezone brasileiro
 */
export function endOfDayWithTimezone(date: Date): Date {
    const zonedDate = toZonedTime(date, TIMEZONE)
    const endDay = endOfDay(zonedDate)
    return fromZonedTime(endDay, TIMEZONE)
}

/**
 * Formata uma data no padrão brasileiro
 */
export function formatBrazilianDate(date: Date): string {
    const zonedDate = toZonedTime(date, TIMEZONE)
    return format(zonedDate, 'dd/MM/yyyy')
}