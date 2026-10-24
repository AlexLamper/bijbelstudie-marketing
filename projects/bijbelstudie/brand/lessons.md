# Lessen - wat Alex wil

Alex' feedback als vaste regels, zodat elke video beter is dan de vorige en geen fout twee keer gebeurt.
De planner en revise lezen dit bij elke run eerst en controleren elk item tegen elke regel
(`planner/PLAN.md` stap 1b en 3b). Nieuwe opmerkingen uit de studio komen er automatisch bij; feedback
uit een chat met Claude zet Claude er meteen in. Een nieuwere opmerking die een oudere tegenspreekt,
wint: dan wordt de regel herschreven. Een regel verdwijnt alleen als Alex hem vervangt.

Vorm: `- Regel. (Alex, <datum>: "<zijn woorden>"; <item>)`

## Wat we maken

- Alleen twee soorten reels: het kaartverhaal (`reel-story`, donker) en de 2D-film (`reel-3d`) in `stickman` of `getekend`. Geen andere formats, looks of stijlen. (Alex, 24 okt: "you should not use the other ones anymore")
- Elke reel vertelt een bijbelverhaal met een echte verhaallijn: een begin dat pakt, een wending, een einde dat blijft hangen. Geen uitleg-video's of lijstjes. (Alex, 24 okt: "the storytelling videos are going to do the best")
- Elke dag één vers van de dag (`verse-still`). (Alex, 24 okt)
- Nooit twee keer hetzelfde: geen herhaalde onderwerpen, verzen of openingszinnen. (Alex: geen repetitieve video's)

## Verhaal en script

- Eén verteller per video, met een van de twee standaardstemmen (`male` of `female`). Pas als er meerdere mensen spreken, mogen ook stemmen uit de testset meedoen. (Alex, 24 okt: "only use those if there is 1 person speaking")
- Wissel de mannen- en vrouwenstem af, zodat Alex beide hoort en de cijfers kunnen kiezen. (Alex, 24 okt: "try the men's voice as well")
- Rustige stemmen (`voiceStyle` `rustig`), geen scherpe of opgewonden toon. (Alex, 24 okt)
- Wat je hoort en wat je ziet, gaat over hetzelfde: elk scherm en elk beeld past bij de zin die dan klinkt. (Alex, 24 okt: schermen die kloppen met wat gezegd wordt)
- Jezus, God en engelen nooit als figuur in beeld; vertel over hen. (vaste regel)

## Stem en geluid

- De stem is altijd goed te volgen: de muziek blijft er duidelijk onder, ook bij een zachte, rustige vrouwenstem en ook in stille stukken tussen zinnen. (Alex, 24 okt: "the background piano music is louder then the 'soft' woman voice")
- Alleen rustige muziek: `calm`, `reflective` of `cinematic`. Geen vrolijke of opzwepende tracks. (Alex, 24 okt)

## Kaartverhaal (reel-story)

- Houd de donkere kaartstijl: die is het visitekaartje. (Alex, 24 okt: "the style with the card is amazing")
- Nooit kaal of minimalistisch: elke kaartscène laat iets nieuws gebeuren - een route die getekend wordt, een reiziger met kilometers, getekende iconen bij wat er gebeurt, de titel en de bijbeltekst in beeld. Minstens 3 kaartscènes per video. (Alex, 24 okt: "its not filled up enough, it's too minimalistic")
- Geen foto's die plots verschijnen: de kaart blijft de hele video in beeld, ook achter tekst en verzen. (Alex: een foto die opeens verschijnt, breekt het)

## 2D-film (reel-3d, stickman en getekend)

- Details moeten kloppen: diepte, realisme, wie doet wat. Iemand die ligt, ligt echt (op de grond of een bed, plat, niet zwevend of half rechtop); wie helpt, knielt bij het hoofd; wie praat, staat naast elkaar en niet door elkaar heen. (Alex, 24 okt: "if someone lays down, it doesn't look realistic ... depth, realism are correct")
- Wat de verteller zegt, gebeurt ook echt in beeld (iemand geeft iets, dan zie je het geven; iemand rijdt, dan zit hij op het dier). Liever een rustig wijd beeld dat klopt dan een actie die nep oogt. (Alex, 24 okt)
- Tekst blijft altijd leesbaar, ook op een lichte lucht. (Alex, 24 okt: over de getekende films)

## Overgangen en tempo

- Scènes lopen vloeiend in elkaar over: geen harde sprongen, geen zwart tussen twee beelden, geen camera die terugspringt. Op de kaart vliegt de camera door van de ene plek naar de volgende. (Alex, 24 okt: "different scenes flow over very well into each other ... it isn't smooth")

## Tekst, verzen en kleuren

- Verzen en accenten in het groenblauw van de app (`#0d9488`), nooit goud of geel. (Alex, 24 okt: "use the green-ish colour from the app")

## Einde en CTA

- Einde zoals grote apps: logo + naam, één voordeel, één knop "Download gratis", de officiële storebadges en "Ook op bijbelstudie.io". Nooit "Zoek ... in de App Store", nooit "link in bio". (vaste regel)

## Plaatsen

- Het vers van de dag gaat alleen naar Instagram en Facebook, als post. (Alex, 24 okt: "this should ONLY be posted on Instagram and maybe on Facebook")
- Elke goedgekeurde reel gaat naar alle vier: TikTok, YouTube, Instagram en Facebook. (Alex, 24 okt: "those will be posted on ALL platforms")
- Goedkeuren zonder datum: wat Alex goedkeurt, komt op de stapel en gaat op de vaste tijden online. (Alex, 24 okt: "no dates")

## Nog op te lossen in de engine

Feedback die geen spec kan oplossen (templates, geluid, beweging). De planner zet het hier en Alex krijgt
er een bericht over; Claude verplaatst het naar "Opgelost" met de commit zodra het in de engine zit.

- (niets open)

## Opgelost in de engine (niet terugdraaien)

Wie een template of `render.mjs` aanpast, leest dit eerst en maakt niets hiervan ongedaan.

- Muziek onder de stem: stem genormaliseerd naar -16 LUFS, muziek 12 dB lager en extra zachter zodra er gesproken wordt (sidechain). `render.mjs` `mixAudio`, `VOICE_GAP` nooit kleiner dan 12. (24 okt, commit 2140be9)
- Vloeiende overgangen: de kaartcamera loopt door tussen kaartscènes (`templates/story.js` `legStart`/`fly`), 2D-shots lossen in elkaar op in 0,65-0,75 s, zonder zwarte dip (`templates/film2d.js` `XF`). (24 okt, commit 2140be9)
- Verzen in het groen van de app in beide 2D-looks en op de kaart. (24 okt)
- Liggen, knielen bij het hoofd, rijden op een dier en spots naast elkaar voor gesprekken (`veld`, `bron-3`) in de 2D-films. (24 okt, `templates/film2d.js`, `3d/catalog.json`)
- Leesbare tekst in getekende films: donkere gloed achter hook en labels. (24 okt, `templates/film2d.js`)
- Volle kaartverhalen: reliëf, regio- en riviernamen, reizigers met km-teller, getekende iconen, titel met passage, wolken. (24 okt, `templates/story.js`)
- Eén stem per video: het hele script in één opname, daarna in zinnen geknipt. (23 okt, `render.mjs`)
