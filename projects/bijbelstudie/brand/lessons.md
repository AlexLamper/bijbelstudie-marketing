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
- Daniel (testset: Nederlandse, rijpe, warme mannenstem uit het Gooi) is de mannenstem die Alex wil horen: bij een mannelijke verteller eerst Daniel, `male` alleen af en toe (bij de Esau-film met `male` vroeg Alex om een andere stem). Vraagt Alex bij een video om een andere stem zonder er een te noemen, kies dan een andere van de drie (voor een man: Daniel, of `male` als het Daniel was). (Alex, 24 okt: "The voice, use: Daniel"; 2026-w44-story-saulus; 25 okt: "Andere stem"; 2026-w44-film-esau)
- De laatste gesproken zin eindigt altijd met: "lees het met uitleg, in de BijbelStudie app." - nooit "lees ze", nooit alleen "in BijbelStudie". Bijvoorbeeld: "Lees het in één Koningen zeventien, met uitleg, in de BijbelStudie app." (Alex, 24 okt, bij Saulus, de weduwe en Jona: "maak dit: 'lees het met uitleg, in de BijbelStudie app'")
- Genummerde bijbelboeken zeg je zoals Alex ze zegt: "één Koningen", "twee Samuël", "één Korinthe" - nooit "eerste Koningen" of "tweede Samuël". (Alex, 24 okt: "zou moeten ... gezegd worden als: 'Lees het in één koningen 17'"; 2026-w44-film-weduwe)
- Rustige stemmen (`voiceStyle` `rustig`), geen scherpe of opgewonden toon. (Alex, 24 okt)
- Wat je hoort en wat je ziet, gaat over hetzelfde: elk scherm en elk beeld past bij de zin die dan klinkt. (Alex, 24 okt: schermen die kloppen met wat gezegd wordt)
- Elke gesproken zin is makkelijk voor te lezen: gewoon, modern Nederlands, korte zinnen met één gedachte (liefst onder 15 woorden). Dus geen lange bijzinnen, geen citaat met "zegt hij" of "huilt ze" erachter ("Ik kan hem niet zien sterven, huilt ze" wordt "Ze wil niet zien dat hij sterft."), geen dubbele punt voor een citaat (vertel het: "Hij hoort dat Ezau eraan komt."), geen puntkomma's, haakjes of afkortingen (ca., v.Chr., km), geen HOOFDLETTERS als HEERE en geen oude woorden als "den", "zeide", "des" (zeg "de Heer"). Een vers staat exact (Statenvertaling) op de verskaart; de stem vertelt datzelfde vers in gewone woorden ("Dan hoort God de stem van de jongen."), ook in de 2D-film - dit gaat voor "say is dan precies de SV-tekst" in plan.md. (Alex, 25 okt: "generate the text so that it's very easy for the voice-over to read it. So try to minimize difficult sentences, weird annotations"; 2026-w44-film-hagar)
- Jezus, God en engelen nooit als figuur in beeld; vertel over hen. (vaste regel)

## Stem en geluid

- De stem is altijd goed te volgen: de muziek blijft er duidelijk onder, ook bij een zachte, rustige vrouwenstem en ook in stille stukken tussen zinnen. (Alex, 24 okt: "the background piano music is louder then the 'soft' woman voice")
- Namen met de juiste klemtoon, en elke keer hetzelfde: E-LI-a (klemtoon op de i). Een naam met een lastige klemtoon gaat in `brand/pronunciation.json` (alleen wat de stem hoort; de ondertitel blijft gewoon). (Alex, 24 okt: "bij de naam 'Elia' leg de klemtoon op de 'i'" - bij 0:03 en 0:44 fout, bij 0:10 goed; 2026-w44-film-weduwe)
- Elke zin klinkt af: aan het eind van een zin gaat de stem omlaag, niet omhoog alsof er nog iets komt. Elke gesproken regel is een hele zin met een punt. (Alex, 24 okt: "Zorg dat het klinkt alsof het het einde van een zin is"; weduwe 0:59)
- Geen zucht, adem of geluidje na het laatste woord: de video eindigt op een normaal, logisch einde. (Alex, 24 okt: "aan het eind nog een soort 'zucht' van de voice-over ... Zorg dat dat NIET het geval is"; Jona)
- De voice-over loopt van de eerste tot de laatste zin door; geen zin valt weg of stopt halverwege (Alex, 25 okt: "Bij ELKE video stopt de voice-over na de eerste zin!!!"). Een zin wordt nooit afgeknipt: elk woord klinkt helemaal uit voor de volgende scène begint. Beeld en stem lopen als één vloeiende lijn. (Alex, 24 okt: "hier lijkt het alsof de stem word afgeknipt ... smooth transitions, in de video en in de stem"; Jona 0:16)
- Alleen rustige muziek: `calm`, `reflective` of `cinematic`. Geen vrolijke of opzwepende tracks. (Alex, 24 okt)

## Kaartverhaal (reel-story)

- Houd de donkere kaartstijl: die is het visitekaartje. (Alex, 24 okt: "the style with the card is amazing")
- Vol, maar niet druk: elke kaartscène laat iets nieuws gebeuren dat het verhaal uitlegt - een route die getekend wordt, een reiziger met kilometers, het ene icoon dat bij de zin hoort, de titel en de passage. Geen versiering die niets uitlegt, hooguit 2 iconen per scène, en wat niet meer nodig is, verdwijnt. Minstens 3 kaartscènes per video. (Alex, 24 okt: eerst "too minimalistic", later bij Saulus: "it's a bit 'too much' with stuff on the screen, keep it simple, and display what is actually useful"; de nieuwste wint: eenvoud met inhoud)
- Iconen passen precies bij wat er staat: het licht uit de hemel bij Damascus is een lichtflits (`licht`), geen ster; een ster alleen voor een echte ster (de wijzen, Abrahams nageslacht). (Alex, 24 okt: "I don't like the star ... more like a 'light'"; Saulus 0:15)
- Geen foto's die plots verschijnen: de kaart blijft de hele video in beeld, ook achter tekst en verzen. (Alex, 24 okt: "Ik vind het niet nice dat er opeens een afbeelding komt bij 'dan komt de storm'"; Jona)

## 2D-film (reel-3d, stickman en getekend)

- Details moeten kloppen: diepte, realisme, wie doet wat. Iemand die ligt, ligt echt (op de grond of een bed, plat, niet zwevend of half rechtop); wie helpt, knielt bij het hoofd; wie praat, staat naast elkaar en niet door elkaar heen. (Alex, 24 okt: "if someone lays down, it doesn't look realistic ... depth, realism are correct")
- Wat de verteller zegt, gebeurt ook echt in beeld (iemand geeft iets, dan zie je het geven; iemand rijdt, dan zit hij op het dier; wie zich in de rivier onderdompelt, staat in het water en gaat kopje onder: `in-beek`, `wade`, `dip`). Liever een rustig wijd beeld dat klopt dan een actie die nep oogt. (Alex, 24 okt)
- Tekst blijft altijd leesbaar, ook op een lichte lucht. (Alex, 24 okt: over de getekende films)
- De openingstitel (hook) blijft lang genoeg staan om hem rustig twee keer te lezen. (Alex, 24 okt: "gaat iets te snel weg, laat deze nog een seconde langer zien"; 2026-w44-film-weduwe)

## Overgangen en tempo

- Scènes lopen vloeiend in elkaar over: geen harde sprongen, geen zwart tussen twee beelden, geen camera die terugspringt. Op de kaart vliegt de camera door van de ene plek naar de volgende. (Alex, 24 okt: "different scenes flow over very well into each other ... it isn't smooth")
- Na een shot naar de lucht (`sky`) gaat de camera logisch terug omlaag; de achtergrond gaat nooit omhoog en springt dan terug. (Alex, 24 okt: "De achtergrond gaat 'omhoog' maar sprint daarna weer terug ... Gewoon smooth en logisch"; weduwe 0:47)
- Kaartverhalen hebben een rustig tempo: per scène één gebeurtenis in één of twee korte zinnen (samen hooguit ongeveer 100 tekens; de scène met het vers mag iets langer), liever een zijpad minder dan haasten, en na elke zin even stilte waarin de kaart, de route of het icoon uitloopt voordat de volgende zin begint. Een reis met twee etappes (Karmel - Jizreël - Berseba) wordt twee kaartscènes, elk met zijn eigen korte zin. (Alex, 25 okt: "Rustiger tempo"; 2026-w44-story-elia)

## Tekst, verzen en kleuren

- Verzen en accenten in het groenblauw van de app (`#0d9488`), nooit goud of geel. (Alex, 24 okt: "use the green-ish colour from the app")

## Einde en CTA

- Einde zoals grote apps: logo + naam, één voordeel, één knop "Download gratis", de officiële storebadges en "Ook op bijbelstudie.io". Nooit "Zoek ... in de App Store", nooit "link in bio". (vaste regel)
- In elke reel staat de hele video door een klein BijbelStudie-watermerk (op donker de omlijnde mark `logo-icon-dark.svg` + de witte wordmark), rustig en half doorzichtig. Het staat echt in een hoek, dicht tegen de rand van het beeld (de hoek waar TikTok en Reels het minst overheen leggen) - niet ergens naar het midden toe of een stuk naar binnen. Geen achtergrond, pilletje of vlak onder het logo en de tekst "BijbelStudie": alleen het logo zelf, hooguit met een zachte schaduw zodat het ook op een lichte lucht leesbaar blijft. Titel, hook, labels en ondertitels blijven er vrij van. Zo ziet de kijker steeds dat de video van BijbelStudie komt en krijgt hij zin in de app. Op de eindkaart staat het logo al groot, daar niet. (Alex, 25 okt: "put some watermark in the video that's is made by BijbelStudie, or the user gets tempted/known to download the BijbelStudie app"; 2026-w44-film-hagar; daarna: "The watermark should be in a complete corner. Not like it is right now, somewhere centered ... maybe not with the background underneath the text"; 2026-w44-film-weduwe; "The watermark isn't nice"; 2026-w44-film-hagar)

## Plaatsen

- Het vers van de dag gaat alleen naar Instagram en Facebook, als post. (Alex, 24 okt: "this should ONLY be posted on Instagram and maybe on Facebook")
- Elke goedgekeurde reel gaat naar alle vier: TikTok, YouTube, Instagram en Facebook. (Alex, 24 okt: "those will be posted on ALL platforms")
- Goedkeuren zonder datum: wat Alex goedkeurt, komt op de stapel en gaat op de vaste tijden online. (Alex, 24 okt: "no dates")

## Nog op te lossen in de engine

Feedback die geen spec kan oplossen (templates, geluid, beweging). De planner zet het hier en Alex krijgt
er een bericht over; Claude verplaatst het naar "Opgelost" met de commit zodra het in de engine zit.

## Opgelost in de engine (niet terugdraaien)

Wie een template of `render.mjs` aanpast, leest dit eerst en maakt niets hiervan ongedaan.

- Muziek onder de stem: stem genormaliseerd naar -16 LUFS, muziek 12 dB lager en extra zachter zodra er gesproken wordt (sidechain). `render.mjs` `mixAudio`, `VOICE_GAP` nooit kleiner dan 12. (24 okt, commit 2140be9)
- Vloeiende overgangen: de kaartcamera loopt door tussen kaartscènes (`templates/story.js` `legStart`/`fly`), 2D-shots lossen in elkaar op in 0,65-0,75 s, zonder zwarte dip (`templates/film2d.js` `XF`). (24 okt, commit 2140be9)
- Verzen in het groen van de app in beide 2D-looks en op de kaart. (24 okt)
- Liggen, knielen bij het hoofd, rijden op een dier en spots naast elkaar voor gesprekken (`veld`, `bron-3`) in de 2D-films. (24 okt, `templates/film2d.js`, `3d/catalog.json`)
- Leesbare tekst in getekende films: donkere gloed achter hook en labels. (24 okt, `templates/film2d.js`)
- Volle kaartverhalen: reliëf, regio- en riviernamen, reizigers met km-teller, getekende iconen, titel met passage, wolken. (24 okt, `templates/story.js`)
- Eén stem per video: het hele script in één opname, daarna in zinnen geknipt. (23 okt, `render.mjs`)
- Klemtoon van namen: `brand/pronunciation.json` (Elia -> Elía), alleen voor de stem; de ondertitel houdt het geschreven woord. (24 okt, `render.mjs` `speakable`)
- Elke regel eindigt als zin (een punt als hij op , ; : eindigde), en voor de slotzin een echte pauze, zodat het verhaal afklinkt en niet omhoog gaat. (24 okt, `render.mjs` `LAST_SEP`)
- Geen zucht en geen afgeknipte woorden: een regel loopt door tot de stem echt stil is (hooguit 0,4 s na het laatste woord, nooit in de volgende regel), met korte fades zodat een knip nooit klikt. (24 okt, `render.mjs` `lineEnd`, `cut`)
- Openingstitel van de 2D-film staat 3,8-5 s in beeld (naar het aantal woorden); het plaatslabel wacht tot de titel weg is. (24 okt, `templates/film2d.js` `HOOK_OUT`)
- Twee shots in dezelfde wereld delen één camera over de knip: die glijdt van het eind van de ene naar het begin van de volgende (tot 1,5 s), dus niets springt terug na een `sky`-shot. (24 okt, `templates/film2d.js` `xfFor`/`camAt`)
- Icoon `licht`: een lichtbundel uit de hemel. Maximaal 2 iconen per kaartscène (validator). (24 okt, `templates/story.js`, `spec.mjs`)
- Rustiger kaart: geen wolken en geen kaartje in de hoek; landen, eilanden en rivieren alleen als het verhaal ze noemt; andere plekken van het verhaal pas nadat het verhaal er geweest is. (24 okt, `templates/story.js`)
- Slotzin en genummerde boeken worden door de validator gecontroleerd. (24 okt, `cli/validate.mjs`)
- Muziek loopt zonder gat door: de nummers zijn 45 s en eindigen met een fade-out, dus bij langere video's zakte de muziek rond 0:45 bijna weg. Nu: het nummer tot vlak voor zijn eigen einde, daarna het middenstuk opnieuw met een crossfade van 3 s. (25 okt, `render.mjs` `musicBody`, `mixAudio`)
- De telefoon met het bijbelhoofdstuk aan het eind van een 2D-film staat boven de ondertitels (die liepen eroverheen). (25 okt, `templates/film2d.js`)
- In het water staan en onderdompelen: base `wade`, actie `dip`, spot `in-beek` (heuvels); de camera gaat mee omlaag zodat hij boven de ondertitels blijft. (25 okt, `templates/film2d.js`, `3d/catalog.json`)
- De stem loopt de hele video door: elke zin wordt uit de opname geknipt met atrim in het filter, zodat de fades vanaf het begin van de zin tellen (25 okt: door een fout viel elke zin na de eerste stil, in alle 10 video's). `voiceGuard` controleert elke zin op geluid, ook het laatste derde; een video met een stille zin wordt niet gemaakt. (25 okt, `render.mjs` `cut`, `voiceGuard`)
- Kaartverhalen renderen ongeveer 5x sneller: de kaart wordt na het laden van het reliëf één keer op canvassen getekend (per zoomniveau scherp), en elk beeldje verschuift alleen het juiste canvas; de SVG-kaart kostte ~2,4 s per beeldje en de meeste GitHub-minuten. Ziet er hetzelfde uit; de SVG blijft als terugval. (25 okt, `templates/story.js` `rasterMap`)
- De tijden van ElevenLabs passen ook bij letters met accenten en gekrulde aanhalingstekens ("Naäman", "’s"): vergeleken zonder accenten. Eerder viel een hele opname daardoor terug op knippen bij pauzes, en kon een zin uit een stilte geknipt worden (Naaman, zin 5). (25 okt, `render.mjs` `unitsFromAlignment`)
- Watermerk in elke reel: rechtsboven, op de hoogte van de titelregel (onder de bovenbalk van TikTok en Reels, boven hun knoppen rechts), een klein BijbelStudie-logo (omlijnde mark + witte wordmark) op een zacht donker pilletje, half doorzichtig, zodat het op de donkere kaart en op een lichte lucht leesbaar is. De hele video, weg zodra de eindkaart komt. De titelchip van het kaartverhaal krimpt ervoor, plaatsnamen en zeenamen wijken; in de 2D-film beginnen de hook en de verskaart eronder. (25 okt, `stage.html` `watermark`/`WM`, `templates/story.js`, `templates/film2d.js`) Let op: de plek en het pilletje zijn vervangen door Alex' nieuwere wens (echt in de hoek, geen achtergrond, zie hieronder); het watermerk zelf, de hele video door en weg bij de eindkaart, blijft.
- Watermerk echt in de hoek, zonder achtergrond: rechtsboven 52 px van de bovenrand en 48 px van de zijkant (was 275 en 56), geen pilletje meer, alleen een zachte schaduw onder mark en "BijbelStudie" zodat het ook op een lichte lucht leesbaar blijft, iets minder doorzichtig (0,8). De hook en de verskaart van de 2D-film beginnen nu op 300 px, onder de bovenbalk van TikTok en Reels (`TEXT_TOP`, was 351 onder het watermerk); de titel van het kaartverhaal hoeft niet meer te krimpen voor het watermerk naast zich. Plaatsnamen wijken nog steeds voor `WM.box`. (25 okt, `stage.html` `WM`/`watermark`/`TEXT_TOP`, `templates/film2d.js` overlays, `templates/story.js` titel)
- Rustiger tempo in kaartverhalen: na elke zin een rust bovenop de 0,25 s: na een kaartscène 0,65 s (samen zo'n 0,9 s stilte), na een reis 1,1 s (route, reiziger en km-teller lopen uit), na een vers 0,6 s, na de hook 0,35 s. De rustige stem leest kaartverhalen op ElevenLabs `speed` 0,92; weigert ElevenLabs dat, dan normaal tempo (nooit geen video). (25 okt, `templates/story.js` `REST`/`units`, `render.mjs` `VOICE_SPEED`, `tts/index.mjs`)
- Een opname met een gefluisterde of ingeslikte zin wordt opnieuw ingesproken: opnames worden bewaard, dus opnieuw renderen gebruikte steeds dezelfde slechte opname (Naaman, zin 5, drie keer). Faalt een opname de controle, dan spreekt de stem hem opnieuw in met een andere seed, hooguit 2 keer; de slechte opname wordt nooit gebruikt. De melding noemt nu ook waar in de opname de zin zat. (25 okt, `render.mjs` `voiceOne`, `TakeError`)
- De stemcontrole meet elke zin tegen de rest van dezelfde opname, niet tegen een vaste grens: de stem Daniel komt zo'n 20 dB zachter uit ElevenLabs (elke zin rond -42 dB), waardoor een korte zin met zijn pauze erachter onder de vaste -50 dB viel en Naaman steeds werd geweigerd terwijl hij goed was. Een zin die duidelijk zachter is dan de rest (12 dB, het laatste derde 16 dB) of onder -60 dB blijft geweigerd; de mix brengt de stem toch naar -16 LUFS. (25 okt, `render.mjs` `voiceGuard`, `GUARD`)
