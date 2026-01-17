export interface Callback {
  message: string
  rollId?: string
}

export interface Die {
  id: string
  name?: string
  value: number
  count: number
  success?: number
  onSuccess?: Callback
  onFailure?: Callback
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