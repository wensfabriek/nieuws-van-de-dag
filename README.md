# Nieuws van de Dag

Persoonlijke nieuwsapp (PWA) met secties voor landelijk, Limburgs en Weerter nieuws, sport, economie en uittips.

## Hoe het werkt
- `public/` is de app zelf (HTML, JavaScript, iconen, service worker).
- `scripts/build_data.py` haalt alle bronnen op en schrijft `public/data.json` en de foto's in `public/img/`.
- GitHub Actions (`.github/workflows/verversen.yml`) draait dat script elke 20 minuten en zet het resultaat op Cloudflare Pages.
- Cloudflare Access zorgt dat alleen jij de app kunt openen.

## Eenmalige installatie
1. **Cloudflare-account**: maak gratis een account aan. Het Pages-project `nieuws-van-de-dag` wordt bij de eerste run automatisch aangemaakt.
2. **API-token**: Cloudflare › *My Profile* › *API Tokens* › *Create Token* › sjabloon *Edit Cloudflare Workers*, of een eigen token met *Account › Cloudflare Pages › Edit*.
3. **Geheimen in GitHub**: repository › *Settings* › *Secrets and variables* › *Actions* › voeg toe:
   - `CLOUDFLARE_API_TOKEN` — het token uit stap 2
   - `CLOUDFLARE_ACCOUNT_ID` — te vinden rechts op de Cloudflare-overzichtspagina
4. **Eerste run**: repository › *Actions* › *Nieuws verversen* › *Run workflow*.
5. **Afschermen**: Cloudflare › *Zero Trust* › *Access* › *Applications* › *Add an application* › *Self-hosted*, domein `nieuws-van-de-dag.pages.dev`, policy *Allow* met je e-mailadres, sessieduur 1 maand.
6. **Op je iPhone**: open de site in Safari, log in met de code uit je mail, tik op *Deel* › *Zet op beginscherm*.

## Lokaal testen
```
pip install -r requirements.txt
python scripts/build_data.py public .cache
python -m http.server -d public 8000
```
