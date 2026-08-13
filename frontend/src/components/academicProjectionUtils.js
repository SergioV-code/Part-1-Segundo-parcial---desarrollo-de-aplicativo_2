export function normalizeNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function calculateProjection(subjects = []) {
  const normalized = subjects.map((subject) => ({
    ...subject,
    credits: normalizeNumber(subject.credits, 0),
    current: normalizeNumber(subject.current, 0),
    target: normalizeNumber(subject.target, subject.current ?? 0),
  }))

  const totalCredits = normalized.reduce((sum, item) => sum + item.credits, 0)

  if (totalCredits === 0) {
    return {
      totalCredits: 0,
      currentAverage: 0,
      projectedAverage: 0,
      delta: 0,
      status: 'Sin datos',
      tone: 'neutral',
    }
  }

  const currentWeighted = normalized.reduce((sum, item) => sum + item.current * item.credits, 0)
  const projectedWeighted = normalized.reduce((sum, item) => sum + item.target * item.credits, 0)

  const currentAverage = currentWeighted / totalCredits
  const projectedAverage = projectedWeighted / totalCredits
  const delta = projectedAverage - currentAverage

  let status = 'Estable'
  let tone = 'neutral'

  if (delta > 5) {
    status = 'Muy favorable'
    tone = 'positive'
  } else if (delta > 1) {
    status = 'Mejora moderada'
    tone = 'positive'
  } else if (delta < -5) {
    status = 'Requiere atención'
    tone = 'warning'
  } else if (delta < 0) {
    status = 'Sigue estable'
    tone = 'neutral'
  }

  return {
    totalCredits,
    currentAverage,
    projectedAverage,
    delta,
    status,
    tone,
  }
}
