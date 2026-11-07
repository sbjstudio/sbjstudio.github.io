# shotbyjulian

en fotoutställning på webben. hela arkivet läses från mappen `shotbyjulian/` — lägger du in en ny bild där finns den på sidan nästa gång den byggs, utan att du rör någon kod.

## lägg till en bild

```bash
npm run sync    # uppdaterar photos.json
npm run dev     # förhandsgranska på http://localhost:4173
```

- `npm run dev` tittar på mappen: lägger du in en bild medan servern kör är det bara att ladda om sidan.
- ligger bilderna i en annan mapp? importera dem direkt:

```bash
node scripts/sync-photos.mjs --from "C:/Users/julia/shotbyjulian"
```

- ordningen är nyast först — den senaste bilden blir startsidans bild, de tre nästa blir kapitel 01–03.
- format: `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`, `.gif`.

## bildtexter (frivilligt)

skapa `shotbyjulian/captions.json` och koppla en text till filnamnet:

```json
{
  "bild (13).jpg": "lamborghini, sommar och svart lack"
}
```

texterna används som alt-text för skärmläsare.

## så är sidan byggd

- **hero** — senaste bilden i sin helhet, titel över, bilden växer mjukt när du scrollar.
- **tre kapitel** — sticky bildsidor där varje fotografi visas i sin helhet med parallax och etikett.
- **arkivet** — alla bilder i ett masonry-flöde, ingen meny och ingen ljuslåda: varje fotografi syns direkt på sidan, i sin egen bildkvot.
- **instagram** — `@shot_by_julian_`, inget kontaktformulär.

språk: svenska, all text i gemener. typsnitt: sf pro (`-apple-system`) på apple-enheter, inter på allt annat. färger: `#000` canvas, `#f5f5f7` text, `#86868b` sekundärtext.

### rörelsen (gsap 3.13 + scrolltrigger, lokalt i `vendor/`)

| grepp | teknik |
| --- | --- |
| intro | tidslinje, `power3.out`, 0,6–1,2 s, bild och rubrik tonar in |
| hero-bild | skalar mjukt med scrollen, `scrub: 0.6`, `ease: "none"` |
| kapitel | parallax ±3 %, bildskala och etikett som tonar in, mjuk skugga |
| arkivet | `ScrollTrigger.batch`, bilden glider in i sin ram + `stagger: 0.06` |
| siffror | räknare som räknar upp antalet fotografier |
| nav | tunn progresslinje som fylls i takt med scrollen |
| instagram | rubrik, länk och not som avslöjas i tur och ordning |

`prefers-reduced-motion` stänger av all scrollanimation — då är sidan helt statisk men komplett, och innehållet syns även om javascript inte laddar.

## publicera

sidan publiceras på **https://sbjstudio.github.io/** — det är en user site i organisationen `sbjstudio`, så repot heter `sbjstudio.github.io` och adressen får ingen undersökväg.

`.github/workflows/deploy.yml` bygger och publicerar sidan vid varje push till `main`. pages är redan aktiverat med **source: github actions**, så inga inställningar behöver klickas. vill du ändra adressen igen: `settings → pages` på repot, eller `git remote set-url origin <ny adress>`.

## bygga manuellt

```bash
npm run build     # skapar dist/ (index.html, styles.css, app.js, photos.json, shotbyjulian/, vendor/)
npm run preview   # serverar dist/ på http://localhost:4173
```

inga npm-beroenden, ingen bundler. node 18+ räcker.

## anpassa

| vad | var |
| --- | --- |
| texter och sektionsordning | `index.html` |
| färger, typografi, radier, kolumner | `styles.css` (`:root` och `.grid`) |
| animationer, hero-bildval, kapitelval | `app.js` (`initMotion`, `renderHero`, `renderChapters`) |
| vilka bilder som blir kapitel | `renderChapters()` — `state.photos.slice(1, 4)` |
| instagram-handle | `index.html` (två länkar) |
