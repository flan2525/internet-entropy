export type RuntimeEnv = {
  ENTROPY_DB?: D1DatabaseLike
  BRAVE_SEARCH_API_KEY?: string
  OBSERVATION_CRON_SECRET?: string
  PUBLIC_APP_URL?: string
}

export type D1Result<T = Record<string, unknown>> = { results: T[] }
export type D1StatementLike = { bind: (...values: unknown[]) => D1StatementLike; first: <T = Record<string, unknown>>() => Promise<T | null>; all: <T = Record<string, unknown>>() => Promise<D1Result<T>>; run: () => Promise<unknown> }
export type D1DatabaseLike = { prepare: (query: string) => D1StatementLike; batch: (statements: D1StatementLike[]) => Promise<unknown> }

export type PagesContext = { request: Request; env: RuntimeEnv; params: Record<string, string>; next: () => Promise<Response> }

export type SearchItem = { title: string; url: string; description: string; age?: string }
