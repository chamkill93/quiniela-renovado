export const HELP_CATEGORIES = ["Todas", "Cómo jugar", "Sorteos y resultados", "Mis jugadas", "Saldo y cuenta"] as const;
export type HelpCategory = typeof HELP_CATEGORIES[number];

export interface HelpQuestion {
  id: string;
  category: Exclude<HelpCategory, "Todas">;
  question: string;
  answer: string;
  href: string;
  linkLabel: string;
}

export const HELP_QUESTIONS: readonly HelpQuestion[] = [
  { id: "jugar", category: "Cómo jugar", question: "¿Cómo hago una jugada de quiniela?", answer: "Elegí la modalidad, ingresá tu número y seleccioná el sorteo y el importe. Revisá el resumen antes de tocar Confirmar jugada. Cuando se registre, la vas a encontrar en Mis jugadas.", href: "/quinielas", linkLabel: "Elegir una modalidad" },
  { id: "modalidades", category: "Cómo jugar", question: "¿Qué diferencia hay entre A la Cabeza y A los Premios?", answer: "A la Cabeza busca acertar las tres cifras del primer resultado. En A los Premios elegís un número de tres cifras y hasta qué posición jugar, entre la 2 y la 14.", href: "/reglas", linkLabel: "Ver las modalidades" },
  { id: "invertida", category: "Cómo jugar", question: "¿Cómo se juega la Invertida?", answer: "Elegís un número de tres cifras para jugar sus distintos órdenes. Seleccioná hasta qué posición querés jugar, de la 1 a la 14, y completá el sorteo y el importe.", href: "/quinielas/invert", linkLabel: "Ver Invertida" },
  { id: "redoblona", category: "Cómo jugar", question: "¿Cómo se juega la Redoblona?", answer: "Combinás un número de cabeza de tres cifras con una terminación de dos. Elegí una posición de la 2 a la 14, el sorteo y el importe; revisá ambos números antes de confirmar.", href: "/quinielas/redoblona", linkLabel: "Ver Redoblona" },
  { id: "numeros", category: "Cómo jugar", question: "¿Qué números puedo elegir?", answer: "En la quiniela tradicional se usan números de 001 a 999. La terminación de Redoblona va de 00 a 99. En Sapy’aite también podés elegir el 000. Conservá los ceros a la izquierda cuando corresponda.", href: "/reglas", linkLabel: "Consultar las reglas" },
  { id: "sapyaite", category: "Cómo jugar", question: "¿En qué se diferencia Sapy’aite de la quiniela tradicional?", answer: "En Sapy’aite elegís tres cifras de 000 a 999 y el importe; el resultado se muestra después de confirmar. En la quiniela tradicional también elegís el sorteo en el que querés participar.", href: "/quinielas/sapyaite", linkLabel: "Conocer Sapy’aite" },
  { id: "sorteos", category: "Sorteos y resultados", question: "¿Dónde consulto los sorteos y sus horarios?", answer: "Los sorteos de quiniela son Tempranero, Matutino, Vespertino y Nocturno. Revisá la fecha y la hora al seleccionar uno. La cuenta regresiva indica cuándo se realiza el sorteo, no el cierre de recepción de jugadas.", href: "/", linkLabel: "Consultar sorteos" },
  { id: "resultados", category: "Sorteos y resultados", question: "¿Cómo consulto los resultados de la quiniela?", answer: "En Resultados encontrás los sorteos publicados, agrupados por fecha. Podés consultar días anteriores y abrir el detalle de cada sorteo para ver sus posturas. Para revisar tu jugada, consultá también su comprobante.", href: "/resultados", linkLabel: "Consultar resultados" },
  { id: "comprobante", category: "Mis jugadas", question: "¿Dónde encuentro el comprobante de mi jugada?", answer: "Entrá en Mis jugadas y tocá Ver mi comprobante. Ahí podés consultar la selección, el importe, la fecha, el estado y el código. Cerrar el comprobante no elimina una jugada registrada.", href: "/mis-jugadas", linkLabel: "Ver mis comprobantes" },
  { id: "pendiente", category: "Mis jugadas", question: "¿Qué significa que mi jugada esté En proceso?", answer: "La jugada está registrada y todavía no tiene una resolución final. Revisá su estado y comprobante en Mis jugadas. Si necesitás ayuda, tené a mano el código del comprobante.", href: "/mis-jugadas", linkLabel: "Revisar mi jugada" },
  { id: "rechazo", category: "Mis jugadas", question: "¿Qué hago si mi jugada falla o no se confirma?", answer: "Leé el mensaje y comprobá tu saldo, los datos y el sorteo elegido. Si hubo un corte de conexión, revisá primero Mis jugadas para comprobar si se registró antes de volver a intentarlo.", href: "/mis-jugadas", linkLabel: "Comprobar mis jugadas" },
  { id: "saldo", category: "Saldo y cuenta", question: "¿Cómo consulto mi saldo y las recargas?", answer: "En Saldo y movimientos podés revisar el disponible y el historial de apuestas, premios, reintegros y recargas. Si la recarga está habilitada, elegí el importe y un medio disponible, y revisá la confirmación.", href: "/saldos", linkLabel: "Ver saldo y movimientos" },
  { id: "autolimites", category: "Saldo y cuenta", question: "¿Cómo defino mis autolímites o hago una pausa?", answer: "En Cuenta, abrí Autolímites para definir importes y tiempo de juego de la sesión. Tomarme un descanso permite pausar nuevas jugadas y recargas durante el período elegido. Antes de confirmar, revisá el alcance y las condiciones que muestra cada opción.", href: "/cuenta", linkLabel: "Gestionar mi cuenta" },
];

export function filterHelpQuestions(query: string, category: HelpCategory) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  return HELP_QUESTIONS.filter((item) => (category === "Todas" || item.category === category)
    && terms.every((term) => normalize(`${item.question} ${item.answer} ${item.category}`).includes(term)));
}
