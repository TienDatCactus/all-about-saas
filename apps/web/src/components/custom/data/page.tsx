import DataState from "./state"
import type React from "react"
import type { DataStateProps } from "./state"
import { PageShell } from "../page-shell"
import { PageHeader } from "../page-shell/page-header"

type HeaderValue<TData> =
  | React.ReactNode
  | ((data: TData | undefined) => React.ReactNode)

interface DataPageProps<TData> extends DataStateProps<TData> {
  /** Static node, or a function of the (possibly not yet loaded) query data. */
  title: HeaderValue<TData>
  description?: HeaderValue<TData>
  actions?: React.ReactNode
}

/*
Full page scaffold for a query-backed page: shell + header + the
pending → error → empty → data branching from DataState.

    <DataPage
      query={useSessionQuery(id)}
      title={(session) => session?.title || "Session"}
      loading={<EditorSkeleton />}
      error={{ title: "Session not found", content: null }}
    >
      {(session) => <Editor session={session} />}
    </DataPage>
*/

export default function DataPage<TData>({
  title,
  description,
  actions,
  ...state
}: DataPageProps<TData>) {
  const resolve = (value: HeaderValue<TData>) =>
    typeof value === "function" ? value(state.query.data) : value

  return (
    <PageShell>
      <PageHeader
        title={resolve(title)}
        description={resolve(description)}
        actions={actions}
      />
      <DataState {...state} />
    </PageShell>
  )
}
