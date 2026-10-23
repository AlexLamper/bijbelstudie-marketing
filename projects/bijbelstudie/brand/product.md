# BijbelStudie - productfeiten

Gecontroleerd op 21 oktober 2026 tegen de code (AlexLamper/bijbelstudie@481610fd, AlexLamper/bijbelstudie-app@7bac22e), bijbelstudie.io, de App Store-pagina en 20 actuele app-screenshots (`assets/screenshots/`). Alleen wat hier staat bestaat. Bij twijfel: niet noemen.

## In een zin

BijbelStudie zet uitleg, context en de grondtekst direct naast elk bijbelhoofdstuk, zodat je niet alleen leest wat er staat, maar ook begrijpt wat het betekent.

## Waar

- Web: bijbelstudie.io (account nodig om te lezen en studeren)
- iPhone en iPad: App Store, "Bijbelstudie - Lees & Leer" (https://apps.apple.com/nl/app/bijbelstudie-lees-leer/id6800668187)
- Android: Google Play (badge op de website)
- Instagram: @bijbelstudie.io
- Zustersites: bijbelquiz.com, bijbelapi.com

## Functies

- Lezen met uitleg ernaast (tab Bijbel / Studie per hoofdstuk)
- Vertalingen (NL): Statenvertaling, NBG-vertaling 1951, De Heilige Schrift 1917, Canisiusbijbel 1939. Daarnaast Engelse en Duitse vertalingen. Het Woord en EBV24 komen eraan; HSV, NBV21 en BGT niet.
- Commentaren: KingComments (gratis); Matthew Henry en Dachsel (Pro), op de website ook Calvijn (Pro)
- Grondtekst: Hebreeuws en Grieks per woord met transliteratie, betekenis en Strong-nummers (Pro)
- Assistent: vragen over het open hoofdstuk, antwoorden met versverwijzingen; toont "AI kan fouten maken. Controleer met de Bijbel."
- Info per bijbelboek: achtergrond met foto's van de plaatsen (met bronvermelding)
- Studies: 76 studies (21 okt 2026), lessen van ±15 minuten. Bladeren via Voor jou, Bijbelboeken, Personen en Thema's; elke maand nieuwe studies (oktober: 8). Voorbeelden: Het leven van Mozes (10 lessen), Geloof in de storm (4), De opstanding van Jezus (3), Het geloof van Abraham (8).
- Lesopbouw: de website noemt 6 stappen (inleiding, context, lezen, verdieping, toetsing, toepassing); een losse studie van een hoofdstuk heeft er 5: Bijbelse context, Lezen, Verdieping, Toetsing (quiz, niet verplicht), Toepassing (eigen antwoord + "Doe er iets mee").
- Kies een hoofdstuk: bestudeer een los hoofdstuk zonder een hele studie te starten
- Jaarplan
- Tekst van de dag met herinnering, leesreeks (streak), beloningen/badges
- Voortgang / je boom: groeit met elk bestudeerd hoofdstuk (XP), niveaus ("Jonge boom"), boomsoorten, seizoenen; "Je boom groeide" na een hoofdstuk
- Je Bijbel: percentage en aantal bijbelboeken gelezen
- Notities, markeringen in kleuren, bladwijzers (gesynchroniseerd tussen web en app)
- Groepen en vriendenkring
- Vriend uitnodigen: geef een vriend een week Pro cadeau via je eigen link
- Onboarding vraagt wat je uit bijbelstudie wilt halen (beter begrijpen, moeilijke passages, dagelijkse gewoonte, meer over Jezus, dieper de theologie in) en stemt de app daarop af
- Leesweergave: thema licht/donker/systeem, tekstgrootte, lettertype (schreefloos, schreef, monospace), regelafstand, letterafstand, versnummers
- Voorlezen met natuurlijke stem (Pro)
- Offline lezen: hele bijbelboeken op je toestel (Pro, app)

## Prijzen

- Gratis, zonder einddatum: lezen, alle studies, KingComments, 10 notities, 3 vragen per dag, voortgang en Levensboom.
- Pro via de website: 9,99 euro per maand of 89,99 euro per jaar. 7 dagen gratis proberen, een keer per account.
- Pro in de App Store: 10,99 euro per maand of 99,99 euro per jaar (paywall: "Bespaar 24%"). Bevestigd door Alex op 21 okt 2026. Opzeggen via je Apple ID; de gratis versie blijft beschikbaar.
- Noem in een advertentie alleen de prijs van het platform waar de advertentie naartoe linkt.
- Pro geeft: offline lezen, alle commentaren, grondtekst, 200 AI-vragen per dag, onbeperkt notities/markeringen/bladwijzers, voorlezen, onbeperkt groepen leiden, extra omgevingen en bomen.

## Bewijs dat we mogen gebruiken

- 80% van christelijke jongeren vindt de Bijbel moeilijk, 85% wil meer lezen (NBG, 2019).
- Het makersverhaal: gebouwd door Alex, een Nederlandse HBO-ICT-student.
- Niet beschikbaar en nooit verzinnen: beoordelingen (de App Store heeft er nog te weinig), reviews, gebruikersaantallen, testimonials.

## E-mail (stand van de code)

- Resend is gekoppeld (`lib/channels/email.ts`), nu alleen voor wachtwoordherstel en antwoorden op feedback.
- Er is nog geen toestemming voor marketingmail: het User-model heeft geen opt-in-veld en het privacybeleid noemt alleen de wachtwoordmail. Eerst opt-in + privacybeleid aanpassen, dan pas nieuwsbrieven.
