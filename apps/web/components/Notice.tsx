/** Aviso importante de una categoría (por ejemplo, Salud: no atiende emergencias). */
export function Notice({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="notice" role="note">
      <strong>Importante:</strong> {text}
    </p>
  );
}
