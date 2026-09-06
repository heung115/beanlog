export default function AdminLoading() {
  return <div aria-busy="true" className="space-y-8 py-5">
    <div className="h-10 w-48 animate-pulse rounded-md bg-surface-warm" />
    <div className="h-28 animate-pulse rounded-lg bg-surface-warm" />
    <div className="h-96 animate-pulse rounded-lg bg-surface-warm" />
  </div>;
}
