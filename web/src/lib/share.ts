export function buildWhatsAppShareUrl(url: string): string {
  const text = `Te paso el presupuesto: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
