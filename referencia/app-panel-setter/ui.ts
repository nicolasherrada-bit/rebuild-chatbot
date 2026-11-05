// Etiquetas y colores compartidos del setter (server y client).
export const ETAPA_LABEL: Record<string, string> = {
  apertura: "Apertura", diagnostico: "Diagnóstico", oferta: "Oferta", cierre: "Cierre",
  compro: "Compró", seguimiento: "Seguimiento", descartado: "Descartado",
};
export const ETAPA_STYLE: Record<string, string> = {
  apertura: "border-navy-700 bg-navy-900 text-azul-claro",
  diagnostico: "border-azul bg-azul/20 text-azul-claro",
  oferta: "border-dorado/60 bg-dorado/10 text-dorado",
  cierre: "border-dorado bg-dorado text-navy-900",
  compro: "border-green-500 bg-green-500/20 text-green-300",
  seguimiento: "border-amber-500/60 bg-amber-500/10 text-amber-300",
  descartado: "border-navy-700 bg-navy-800 text-azul",
};
export const FICHA_LABEL: Record<string, string> = {
  edad: "Edad", anios_entrenando: "Entrena hace", nivel: "Nivel", que_hace_hoy: "Hoy hace", objetivo: "Objetivo",
  dolor: "Dolor", intentos_previos: "Probó", tiempo_disponible: "Tiempo", ocupacion: "Ocupación",
  lesiones: "Lesiones", por_que_ahora: "Por qué ahora", inversion: "Inversión",
};
export const colorScore = (s: number) => (s >= 70 ? "bg-green-500" : s >= 40 ? "bg-dorado" : "bg-azul");
export const CANAL_ICON: Record<string, string> = { instagram: "📸", whatsapp: "💬", simulador: "🧪" };
