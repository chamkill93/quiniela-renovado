export interface HelpQuestion {
  id: string;
  question: string;
  answer: string;
  href: string;
  linkLabel: string;
  searchTerms?: string;
}

export const HELP_QUESTIONS: readonly HelpQuestion[] = [
  {
    id: "jugar",
    question: "¿Cómo hago una jugada de Quiniela?",
    answer: "Elegí la modalidad, ingresá tu selección y completá la postura o el alcance cuando corresponda. Después seleccioná uno o varios sorteos abiertos, definí el importe por sorteo y revisá el resumen antes de confirmar. Las reglas consideran cada sorteo elegido como una jugada independiente.",
    href: "/quinielas",
    linkLabel: "Elegir una modalidad",
    searchTerms: "apostar confirmar importe resumen",
  },
  {
    id: "modalidades",
    question: "¿Qué modalidades de Quiniela están disponibles?",
    answer: "Podés elegir A la Cabeza, A los Premios, Invertida, Redoblona y Sapy’aite. Cada modalidad define qué selección hacés, qué posiciones participan y cómo se compara tu jugada con el resultado. Consultá las reglas antes de confirmar.",
    href: "/reglas",
    linkLabel: "Consultar las reglas",
    searchTerms: "tipos juegos opciones",
  },
  {
    id: "cabeza",
    question: "¿Cómo se juega A la Cabeza?",
    answer: "Elegí un número de tres cifras entre 001 y 999. Para acertar, debe coincidir exactamente y en el mismo orden con la primera posición del sorteo confirmado. El 000 no es válido en esta modalidad.",
    href: "/quinielas/head",
    linkLabel: "Jugar A la Cabeza",
    searchTerms: "primera postura posición exacta tres cifras",
  },
  {
    id: "premios",
    question: "¿Cómo se juega A los Premios?",
    answer: "Elegí un número de tres cifras entre 001 y 999 y una postura de 2 a 14. El número debe aparecer exactamente, en el mismo orden y dentro de las posiciones cubiertas por la postura elegida. El 000 no es válido en esta modalidad.",
    href: "/quinielas/prizes",
    linkLabel: "Jugar A los Premios",
    searchTerms: "posición límite postura exacta tres cifras",
  },
  {
    id: "invertida",
    question: "¿Cómo se juega la Invertida?",
    answer: "Ingresá un número de tres cifras entre 001 y 999, con las tres cifras distintas entre sí, y elegí una postura de 1 a 14. La jugada participa con los seis órdenes posibles de esas cifras. Uno de esos órdenes debe aparecer dentro de la postura elegida.",
    href: "/quinielas/invert",
    linkLabel: "Jugar Invertida",
    searchTerms: "seis 6 combinaciones permutaciones órdenes",
  },
  {
    id: "redoblona",
    question: "¿Cómo se juega la Redoblona?",
    answer: "Combiná dos números de dos cifras, de 00 a 99. El alcance inicial va de Cabeza a 14 y el segundo alcance va de 7 a 14; este último debe ser igual o mayor al inicial. Para acertar se necesitan los dos números en posiciones diferentes del mismo sorteo. Si la inicial es Cabeza, esa aparición no se vuelve a contar en el segundo alcance.",
    href: "/quinielas/redoblona",
    linkLabel: "Jugar Redoblona",
    searchTerms: "doble acierto inicial segunda postura dos números",
  },
  {
    id: "sapyaite",
    question: "¿Cómo se juega Sapy’aite?",
    answer: "Elegí un número de tres cifras entre 000 y 999 y un importe. El resultado se genera de forma inmediata y se compara con una única selección. Para acertar deben coincidir exactamente las tres cifras y en el mismo orden; no se elige sorteo ni postura.",
    href: "/quinielas/sapyaite",
    linkLabel: "Jugar Sapy’aite",
    searchTerms: "instantáneo inmediato número virtual",
  },
  {
    id: "numeros",
    question: "¿Qué números puedo elegir?",
    answer: "A la Cabeza y A los Premios usan números de 001 a 999. En Invertida, la selección debe tener tres cifras distintas entre sí. Redoblona usa dos números de 00 a 99 y Sapy’aite admite de 000 a 999. Conservá los ceros a la izquierda cuando corresponda.",
    href: "/reglas",
    linkLabel: "Consultar las reglas",
    searchTerms: "rango ceros izquierda cifras 000 001 999",
  },
  {
    id: "postura",
    question: "¿Qué significa la postura?",
    answer: "La postura indica hasta qué posición del sorteo participa una jugada. La posición 1 es A la Cabeza. A los Premios permite elegir de la 2 a la 14 e Invertida de la 1 a la 14. En Redoblona se elige un alcance inicial y otro para el segundo acierto.",
    href: "/reglas",
    linkLabel: "Ver posiciones y alcances",
    searchTerms: "cabeza premios rango puesto orden",
  },
  {
    id: "sorteos",
    question: "¿Cómo elijo un sorteo y cuándo cierra?",
    answer: "Seleccioná uno o varios sorteos que figuren abiertos y comprobá su fecha y hora antes de confirmar. Cada sorteo se registra y evalúa por separado. Las reglas exigen que la jugada quede registrada antes del horario de cierre; una vez cerrado, ya no admite nuevas jugadas.",
    href: "/",
    linkLabel: "Consultar sorteos",
    searchTerms: "tempranero matutino vespertino nocturno horario fecha",
  },
  {
    id: "resultados",
    question: "¿Dónde consulto los resultados de la Quiniela?",
    answer: "En Resultados podés elegir la fecha, abrir cada sorteo publicado y revisar sus posiciones. Compará siempre el sorteo, la modalidad, el número y la postura con los datos de tu comprobante.",
    href: "/resultados",
    linkLabel: "Consultar resultados",
    searchTerms: "números ganadores sorteo posturas fecha",
  },
  {
    id: "comprobante",
    question: "¿Por qué debo revisar y conservar el comprobante?",
    answer: "El comprobante respalda la jugada registrada. Revisá que muestre correctamente la fecha, el sorteo, la modalidad, los números, la postura o el alcance, el importe y el código de seguridad. Las reglas indican que debés conservarlo para cualquier consulta o reclamo.",
    href: "/mis-jugadas",
    linkLabel: "Ver mis comprobantes",
    searchTerms: "ticket código seguridad respaldo conservar jugada",
  },
  {
    id: "premio-plazo",
    question: "¿Cuál es el plazo para reclamar un premio?",
    answer: "Las reglas establecen un plazo de hasta 60 días hábiles después del sorteo. Conservá el comprobante en buenas condiciones, porque es el respaldo de la jugada y puede ser necesario para gestionar el reclamo.",
    href: "/mis-jugadas",
    linkLabel: "Buscar mi comprobante",
    searchTerms: "cobrar pago caducidad vencimiento sesenta 60 días hábiles",
  },
];

export function filterHelpQuestions(query: string) {
  const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);

  return HELP_QUESTIONS.filter((item) => terms.every((term) => normalize(
    `${item.question} ${item.answer} ${item.linkLabel} ${item.searchTerms ?? ""}`,
  ).includes(term)));
}
