import type { RuleCondition, RuleDefinition } from './types'
import type { ArdouraEvent } from '@/lib/kafka/events'

// Resolve a dot-path like "metadata.severity" from an object
function getField(obj: unknown, path: string): unknown {
  const parts = path.split('.')
  let cur: unknown = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

// Replace {{event.field}} placeholders in param values
export function interpolate(template: unknown, event: ArdouraEvent): unknown {
  if (typeof template === 'string') {
    return template.replace(/\{\{event\.([^}]+)\}\}/g, (_, path) => {
      const val = getField(event, path)
      return val != null ? String(val) : ''
    })
  }
  if (Array.isArray(template)) return template.map(v => interpolate(v, event))
  if (template !== null && typeof template === 'object') {
    return Object.fromEntries(
      Object.entries(template as Record<string, unknown>).map(([k, v]) => [k, interpolate(v, event)])
    )
  }
  return template
}

function evaluateCondition(cond: RuleCondition, event: ArdouraEvent): boolean {
  const fieldVal = getField(event, cond.field)

  switch (cond.operator) {
    case 'exists':     return fieldVal !== undefined && fieldVal !== null
    case 'not_exists': return fieldVal === undefined || fieldVal === null
    case 'eq':         return fieldVal == cond.value
    case 'neq':        return fieldVal != cond.value
    case 'gt':         return typeof fieldVal === 'number' && fieldVal > (cond.value as number)
    case 'gte':        return typeof fieldVal === 'number' && fieldVal >= (cond.value as number)
    case 'lt':         return typeof fieldVal === 'number' && fieldVal < (cond.value as number)
    case 'lte':        return typeof fieldVal === 'number' && fieldVal <= (cond.value as number)
    case 'contains':   return typeof fieldVal === 'string' && fieldVal.includes(String(cond.value))
    case 'not_contains': return typeof fieldVal === 'string' && !fieldVal.includes(String(cond.value))
    case 'starts_with': return typeof fieldVal === 'string' && fieldVal.startsWith(String(cond.value))
    case 'ends_with':   return typeof fieldVal === 'string' && fieldVal.endsWith(String(cond.value))
    case 'in':         return Array.isArray(cond.value) && cond.value.includes(fieldVal)
    case 'not_in':     return Array.isArray(cond.value) && !cond.value.includes(fieldVal)
    case 'matches_regex': {
      try {
        return typeof fieldVal === 'string' && new RegExp(String(cond.value)).test(fieldVal)
      } catch { return false }
    }
    default: return false
  }
}

export function evaluateRule(rule: RuleDefinition, event: ArdouraEvent): boolean {
  if (!rule.enabled) return false
  if (rule.topic && event.topic !== rule.topic) return false
  return rule.conditions.every(cond => evaluateCondition(cond, event))
}

export function matchingRules(rules: RuleDefinition[], event: ArdouraEvent): RuleDefinition[] {
  return rules.filter(r => evaluateRule(r, event))
}
