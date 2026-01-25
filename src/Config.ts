export interface Callback {
  message: string
  rollIds?: string[]
}

export interface Range {
  id: string
  min: number
  max: number
  label?: string
  message?: string
  rollIds?: string[]
}

export type DieMode = 'threshold' | 'range'

export interface Die {
  id: string
  name?: string
  value: number
  count: number
  // Mode toggle: 'threshold' (default, pass/fail) or 'range' (multiple ranges)
  mode?: DieMode
  // Threshold mode fields
  success?: number
  onSuccess?: Callback
  onFailure?: Callback
  // Range mode fields
  ranges?: Range[]
}

export interface Roll {
  id: string
  name: string
  dice: Die[]
}

export interface Journey {
  id: string
  name: string
  rolls: Roll[]
}

export type Config = Record<string, Journey>;