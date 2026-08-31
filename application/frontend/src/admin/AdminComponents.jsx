import { useState } from "react";

export function PageState({ loading, error, children }) {
  // Use one loading and error presentation throughout the admin workspace.
  if (loading) return <div className="admin-state">Loading…</div>;
  if (error) return <div className="admin-alert error">{error}</div>;
  return children;
}

export function Header({ eyebrow, title, description, action }) {
  return (
    <header className="admin-page-header">
      <div>
        <span className="admin-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

export function Empty({ text }) {
  return <div className="admin-empty">{text}</div>;
}

export function ConfirmButton({ label = "Delete", onConfirm, disabled }) {
  // Destructive operations require explicit confirmation.
  return (
    <button
      className="admin-link danger"
      type="button"
      disabled={disabled}
      onClick={() => {
        if (window.confirm("This action cannot be undone. Continue?"))
          onConfirm();
      }}
    >
      {label}
    </button>
  );
}

export function Dialog({ title, open, onClose, children, size = "default" }) {
  // Backdrop clicks close the modal; clicks inside it stop propagation.
  if (!open) return null;
  return (
    <div
      className="admin-modal-backdrop"
      role="presentation"
      onMouseDown={onClose}
    >
      <section
        className={`admin-modal ${size === "wide" ? "admin-modal-wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="admin-modal-title">
          <h2>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="admin-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function AdminForm({
  fields,
  initial = {},
  submitLabel = "Save",
  onSubmit,
  onCancel,
}) {
  // One schema-driven form supports all admin dialogs. Field definitions supply
  // labels, input types, validation requirements, and reference-data options.
  const [values, setValues] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event) {
    event.preventDefault();
    const missingGroup = fields.find((field) =>
      field.type === "checkbox-group" && field.required && !(values[field.name] || []).length
    );
    if (missingGroup) {
      setError(`Select at least one ${missingGroup.label.toLowerCase()}.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="admin-form-grid">
        {fields.map((field) => (
          <Field key={field.name} label={field.label}>
            {field.type === "select" ? (
              <select
                value={values[field.name] ?? ""}
                required={field.required}
                onChange={(e) =>
                  setValues({ ...values, [field.name]: e.target.value })
                }
              >
                <option value="">Select…</option>
                {field.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "checkbox-group" ? (
              <div className="admin-checkbox-group">
                {field.options.map((option) => {
                  const selected = values[field.name] || [];
                  return <label key={option.value}>
                    <input type="checkbox" checked={selected.includes(option.value)} onChange={(event) => {
                      setValues({
                        ...values,
                        [field.name]: event.target.checked
                          ? [...selected, option.value]
                          : selected.filter((value) => value !== option.value),
                      });
                    }} />
                    <span>{option.label}</span>
                  </label>;
                })}
              </div>
            ) : field.type === "textarea" ? (
              <textarea
                rows="4"
                value={values[field.name] ?? ""}
                required={field.required}
                onChange={(e) =>
                  setValues({ ...values, [field.name]: e.target.value })
                }
              />
            ) : field.type === "checkbox" ? (
              <input
                type="checkbox"
                checked={Boolean(values[field.name])}
                onChange={(e) =>
                  setValues({ ...values, [field.name]: e.target.checked })
                }
              />
            ) : (
              <input
                type={field.type || "text"}
                value={values[field.name] ?? ""}
                required={field.required}
                min={field.min}
                onChange={(e) =>
                  setValues({ ...values, [field.name]: e.target.value })
                }
              />
            )}
          </Field>
        ))}
      </div>
      {error && <div className="admin-alert error">{error}</div>}
      <div className="admin-form-actions">
        <button
          type="button"
          className="admin-button secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button className="admin-button" disabled={saving}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
