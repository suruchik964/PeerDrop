export default function Modal({ title, onClose, closable = true, children }) {
  return (
    <div
      className="fixed inset-0 z-10 flex items-center justify-center bg-black/60 p-4"
      onClick={closable ? onClose : undefined}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          {closable && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              ✕
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
