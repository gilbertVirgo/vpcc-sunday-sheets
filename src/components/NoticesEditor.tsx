export function NoticesEditor({
  value,
  onChange,
  onReload,
}: {
  value: string;
  onChange: (value: string) => void;
  onReload: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label htmlFor="notices" className="text-body-sm font-bold text-ink">
          Notices
        </label>
        <button type="button" onClick={onReload} className="rounded-md border border-line-strong px-3 py-1 text-caption text-ink hover:bg-surface-sunken">
          Reload from calendar
        </button>
      </div>
      <textarea
        id="notices"
        rows={10}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-line-strong bg-surface-raised px-3 py-2 text-body-sm text-ink"
      />
      <p className="text-caption text-ink-muted">Each line is one paragraph on the back panel.</p>
    </div>
  );
}
