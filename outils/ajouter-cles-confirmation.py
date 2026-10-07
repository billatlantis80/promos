#!/usr/bin/env python3
"""Ajoute les 5 phrases de l'activation par e-mail aux 9 langues.

Contexte : B a demandé « envoyer un mail de confirmation pour activer le compte ».
Le tableau Google envoie déjà l'e-mail ; ces phrases-ci sont celles affichées
DANS L'APPLICATION, autour de cet envoi.
"""
import re
import sys
from pathlib import Path

CHEMIN = Path("/opt/data/webdev/projects/promos/public/langues.js")
LANGUES = ["fr", "nl", "de", "en", "es", "it", "pt", "pl", "sv"]

PHRASES = {
    "Un e-mail de confirmation part vers {n}. Ouvre-le et clique le lien pour activer ton compte.": {
        "fr": "Un e-mail de confirmation part vers {n}. Ouvre-le et clique le lien pour activer ton compte.",
        "nl": "Er vertrekt een bevestigingsmail naar {n}. Open ze en klik op de link om je account te activeren.",
        "de": "Eine Bestätigungs-E-Mail geht an {n}. Öffne sie und klicke auf den Link, um dein Konto zu aktivieren.",
        "en": "A confirmation email is on its way to {n}. Open it and click the link to activate your account.",
        "es": "Un correo de confirmación sale hacia {n}. Ábrelo y haz clic en el enlace para activar tu cuenta.",
        "it": "Un'e-mail di conferma parte verso {n}. Aprila e clicca il link per attivare il tuo account.",
        "pt": "Um e-mail de confirmação segue para {n}. Abre-o e clica na ligação para ativar a tua conta.",
        "pl": "E-mail potwierdzający został wysłany na {n}. Otwórz go i kliknij link, aby aktywować konto.",
        "sv": "Ett bekräftelsemail skickas till {n}. Öppna det och klicka på länken för att aktivera ditt konto.",
    },
    "Inscription : {n} — en attente de confirmation": {
        "fr": "Inscription : {n} — en attente de confirmation",
        "nl": "Inschrijving: {n} — wacht op bevestiging",
        "de": "Anmeldung: {n} — wartet auf Bestätigung",
        "en": "Sign-up: {n} — awaiting confirmation",
        "es": "Inscripción: {n} — pendiente de confirmación",
        "it": "Iscrizione: {n} — in attesa di conferma",
        "pt": "Inscrição: {n} — à espera de confirmação",
        "pl": "Zapis: {n} — oczekuje na potwierdzenie",
        "sv": "Anmälan: {n} — väntar på bekräftelse",
    },
    "Renvoyer l'e-mail de confirmation": {
        "fr": "Renvoyer l'e-mail de confirmation",
        "nl": "Bevestigingsmail opnieuw versturen",
        "de": "Bestätigungs-E-Mail erneut senden",
        "en": "Resend the confirmation email",
        "es": "Reenviar el correo de confirmación",
        "it": "Invia di nuovo l'e-mail di conferma",
        "pt": "Reenviar o e-mail de confirmação",
        "pl": "Wyślij ponownie e-mail potwierdzający",
        "sv": "Skicka bekräftelsemejlet igen",
    },
    "Ce lien a déjà été utilisé : ton inscription est confirmée.": {
        "fr": "Ce lien a déjà été utilisé : ton inscription est confirmée.",
        "nl": "Deze link is al gebruikt: je inschrijving is bevestigd.",
        "de": "Dieser Link wurde bereits benutzt: Deine Anmeldung ist bestätigt.",
        "en": "This link has already been used: your sign-up is confirmed.",
        "es": "Este enlace ya se ha usado: tu inscripción está confirmada.",
        "it": "Questo link è già stato usato: la tua iscrizione è confermata.",
        "pt": "Esta ligação já foi usada: a tua inscrição está confirmada.",
        "pl": "Ten link został już użyty: twój zapis jest potwierdzony.",
        "sv": "Den här länken har redan använts: din anmälan är bekräftad.",
    },
    "Ton inscription est confirmée. Tu recevras les bons plans.": {
        "fr": "Ton inscription est confirmée. Tu recevras les bons plans.",
        "nl": "Je inschrijving is bevestigd. Je ontvangt de koopjes.",
        "de": "Deine Anmeldung ist bestätigt. Du erhältst die Angebote.",
        "en": "Your sign-up is confirmed. You will receive the deals.",
        "es": "Tu inscripción está confirmada. Recibirás las ofertas.",
        "it": "La tua iscrizione è confermata. Riceverai le offerte.",
        "pt": "A tua inscrição está confirmada. Vais receber as promoções.",
        "pl": "Twój zapis jest potwierdzony. Będziesz otrzymywać okazje.",
        "sv": "Din anmälan är bekräftad. Du kommer att få erbjudandena.",
    },
}


def littéral(s: str) -> str:
    if "'" in s and '"' not in s:
        return '"' + s + '"'
    if '"' in s and "'" not in s:
        return "'" + s + "'"
    if "'" in s and '"' in s:
        return '"' + s.replace('"', '\\"') + '"'
    return "'" + s + "'"


source = CHEMIN.read_text(encoding="utf-8")
if all(source.count(littéral(p) + ":") >= 9 for p in PHRASES):
    print("Déjà fait : les 5 phrases sont présentes dans les 9 langues.")
    sys.exit(0)

debut = source.index("const EXTRA = {")
fin = source.index("\n};", debut)
bloc = source[debut:fin]
motif = re.compile(r"\n  (fr|nl|de|en|es|it|pt|pl|sv): \{\n")
bornes = [(m.group(1), m.end()) for m in motif.finditer(bloc)]
if [c for c, _ in bornes] != LANGUES:
    print(f"ERREUR : langues trouvées = {[c for c, _ in bornes]}")
    sys.exit(1)

nouveau = bloc
for code, ouverture in reversed(bornes):
    fermeture = nouveau.index("\n  },", ouverture)
    lignes = "".join(f"\n    {littéral(c)}: {littéral(v[code])}," for c, v in PHRASES.items())
    nouveau = nouveau[:fermeture] + lignes + nouveau[fermeture:]

CHEMIN.write_text(source[:debut] + nouveau + source[fin:], encoding="utf-8")

relu = CHEMIN.read_text(encoding="utf-8")
for cle in PHRASES:
    n = relu.count(littéral(cle) + ":")
    print(f"  {'OK' if n >= 9 else 'MANQUANT'} ({n}/9) {cle[:60]}")
    if n < 9:
        sys.exit(1)
print("5/5 phrases présentes dans les 9 langues.")
