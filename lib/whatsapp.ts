// Tutti i testi dei messaggi WhatsApp (SPEC 6.6). Nessuna email, nessuna notifica push.

/** Numero nel formato di wa.me: solo cifre, con prefisso internazionale (39 se manca). */
export function normalizzaTelefono(telefono: string): string {
  let n = telefono.replace(/[^\d+]/g, "");
  if (n.startsWith("+")) n = n.slice(1);
  else if (n.startsWith("00")) n = n.slice(2);
  else if (/^3\d{8,9}$/.test(n) || /^0\d{5,10}$/.test(n)) n = `39${n}`;
  return n;
}

/** Link che apre WhatsApp con il messaggio pronto. Senza telefono: si sceglie a chi mandarlo. */
export function linkWhatsApp(testo: string, telefono?: string): string {
  const destinatario = telefono ? normalizzaTelefono(telefono) : "";
  return `https://wa.me/${destinatario}?text=${encodeURIComponent(testo)}`;
}

export function indirizzoGestionale(): string {
  return typeof window === "undefined" ? "/gestione" : `${window.location.origin}/gestione`;
}

/** Indirizzo completo di una pagina del gestionale, da mettere nei messaggi. */
export function linkPagina(percorso: string): string {
  return typeof window === "undefined" ? percorso : `${window.location.origin}${percorso}`;
}

const conScadenza = (scadenza?: string) => (scadenza ? `\nEntro: ${scadenza}` : "");

export const testi = {
  credenziali: (p: { nome: string; email: string; password: string }) =>
    `Ciao ${p.nome}! Ti ho aggiunto al gestionale della festa di Colleiano.\n\n` +
    `Entra da qui: ${indirizzoGestionale()}\n` +
    `Email: ${p.email}\n` +
    `Password temporanea: ${p.password}\n\n` +
    `Al primo accesso ti chiederà di scegliere una password tua.`,

  aggiuntoAllaFesta: (p: { nome: string; festa: string }) =>
    `Ciao ${p.nome}! Ti ho aggiunto alla festa "${p.festa}" nel gestionale di Colleiano.\n` +
    `Entra con le tue solite credenziali: ${indirizzoGestionale()}`,

  nuovaPassword: (p: { nome: string; email: string; password: string }) =>
    `Ciao ${p.nome}! Ecco una nuova password temporanea per il gestionale di Colleiano.\n\n` +
    `Entra da qui: ${indirizzoGestionale()}\n` +
    `Email: ${p.email}\n` +
    `Password temporanea: ${p.password}\n\n` +
    `Appena entri ti chiederà di sceglierne una tua.`,

  taskAssegnato: (p: { nome: string; titolo: string; scadenza?: string; link: string }) =>
    `Ciao ${p.nome}! Ti ho dato un task nel gestionale di Colleiano:\n\n` +
    `"${p.titolo}"${conScadenza(p.scadenza)}\n\n` +
    `Lo trovi qui: ${p.link}`,

  richiestaInviata: (p: { nome: string; commissione: string; titolo: string; link: string }) =>
    `Ciao ${p.nome}! Ho fatto una richiesta alla commissione ${p.commissione}:\n\n` +
    `"${p.titolo}"\n\n` +
    `Puoi accettarla e assegnarla, oppure rifiutarla, da qui: ${p.link}`,

  richiestaAccettata: (p: { nome: string; titolo: string; responsabile: string; link: string }) =>
    `Ciao ${p.nome}! La tua richiesta "${p.titolo}" è stata accettata: se ne occupa ${p.responsabile}.\n\n` +
    `La segui da qui: ${p.link}`,

  richiestaRifiutata: (p: { nome: string; titolo: string; motivo: string; link: string }) =>
    `Ciao ${p.nome}! La tua richiesta "${p.titolo}" non è stata accettata.\n` +
    `Motivo: ${p.motivo}\n\n` +
    `Dettagli: ${p.link}`,

  condividiTask: (p: { titolo: string; commissione: string; stato: string; responsabile: string; scadenza?: string; link: string }) =>
    `${p.titolo}\n` +
    `Commissione: ${p.commissione}\n` +
    `Stato: ${p.stato}\n` +
    `Chi se ne occupa: ${p.responsabile}${conScadenza(p.scadenza)}\n\n` +
    `${p.link}`,
};
