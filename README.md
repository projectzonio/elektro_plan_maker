# elektro_plan_maker

Webový editor elektroinstalačních plánů. Nahraješ PDF půdorysu, zakreslíš do něj přístroje
(zásuvky, vypínače, světla, rozvaděč), natáhneš trasy kabelů, rozdělíš je do okruhů a editor
spočítá materiál. Výsledek uložíš jako JSON nebo exportuješ do PNG / PDF.

Běží lokálně: malý Node.js server (Express) a frontend bez build kroku.

## Rychlý start

Potřebuješ Node.js 18 nebo novější.

```bash
npm install
npm start
```

Otevři <http://localhost:5177>.

## Jak s tím pracovat

1. **Import PDF** – načte se první strana půdorysu jako podklad.
2. **Měřítko** – délky tras a materiál se počítají v metrech podle pole „Měřítko: 100 px = m“. Můžeš ho zadat ručně, nebo zadat známou délku v metrech a použít **Změřit měřítko z PDF**.
3. **Nástroje** – zásuvka 1f / 3f, vypínače č. 1, 5, 6, 7, světlo, rozvaděč. Symboly lze otáčet a měnit jejich velikost.
4. **Trasy kabelů** – kreslí se bod po bodu, začínají obvykle v rozvaděči. Úseky od rozvaděče k první přípojce se vedou jako přívod, ostatní jako propojení.
5. **Okruhy** – každá nová trasa patří do právě aktivního okruhu.
6. **Materiál** – odhad délek kabelů a počtu přístrojů podle zakreslených tras.
7. **Bílá maska** – překryje část podkladu, když ruší čitelnost.
8. **Uložit JSON / Načíst JSON** – celý rozpracovaný plán. Editor si stav průběžně ukládá i do `localStorage` prohlížeče.
9. **Export PNG / Export PDF** – PDF obsahuje plán a stranu se souhrnem materiálu.

### Ukázka

Ve složce [`examples/`](examples) je plán rodinného domu 4+1 (33 přístrojů a 4 okruhy, bez zakreslených tras):

- `house-4plus1.plan-editor.json` – načteš ho tlačítkem **Načíst JSON**,
- `house-4plus1.svg` – náhled půdorysu, na kterém plán vznikl.

## Nastavení

| Proměnná | Výchozí | Význam |
|----------|---------|--------|
| `PLAN_MAKER_PORT` | `5177` | port serveru |
| `PLAN_MAKER_HOST` | `127.0.0.1` | adresa, na které server poslouchá; `0.0.0.0` jen pokud ho chceš vědomě zpřístupnit v síti |

Server nemá autentizaci. Nevystavuj ho do internetu.

## HTTP rozhraní

| Metoda | Cesta | Popis |
|--------|-------|-------|
| GET | `/api/plan-maker/symbols/bundle` | JS balík všech symbolů (načítá ho `index.html`) |
| GET | `/api/plan-maker/symbols/bundle/info` | počet souborů, velikost a čas sestavení balíku |
| GET | `/api/plan-maker/plans/default-home` | ukázkový plán (JSON, formát plan-editor-v2) |
| GET | `/api/plan-maker/export/default-home/plan-editor-v2` | totéž ke stažení |
| GET | `/source.pdf?file=<cesta>` | pošle lokální soubor `.pdf` (jiné přípony server odmítne) |

PDF a PDF export obsluhují knihovny [pdf.js](https://github.com/mozilla/pdf.js) a
[jsPDF](https://github.com/parallax/jsPDF), které server servíruje z `node_modules`.

## Struktura

```
server.js            Express server, statické soubory a API
symbol-loader.js     skládá balík symbolů z public/symbols/
public/
  index.html         rozhraní editoru
  modules/           stav, import PDF, vykreslení, hit-test, interakce, export, materiál
  symbols/           definice symbolů (přidáš soubor a zaregistruješ ho v symbol-loader.js)
examples/            ukázkový plán
```

## Symboly

Každý symbol je samostatný soubor v `public/symbols/`, který se zaregistruje přes
`window.PlanEditorSymbols.register(typ, {...})` (vzor: `light.js`). Server je skládá do jednoho
balíku podle seznamu v `symbol-loader.js`. Tlačítka nástrojů jsou v `public/index.html`
(atribut `data-tool`).

## Stav projektu

Prototyp. Automatické testy zatím nejsou a formát JSON se může měnit.

## Licence

[MIT](LICENSE)
