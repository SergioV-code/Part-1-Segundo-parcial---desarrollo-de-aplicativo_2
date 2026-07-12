import { MOD_ACADEMICA, MOD_TECNICO } from './constants'

export const isGov = rol => rol === 'Analista MINERD' || rol === 'Analista MESCYT'

export function normalizeModalidad(value) {
  const text = (value ?? '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (!text) return MOD_ACADEMICA
  if (text.includes('tecnico')) return MOD_TECNICO
  return MOD_ACADEMICA
}

export function fmt(isoString) {
  try { return new Date(isoString).toLocaleString('es-DO') } catch { return isoString }
}
