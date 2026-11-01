#!/usr/bin/env python3
"""Fetch all sources for Nieuws van de Dag and write <out>/data.json plus thumbnails in <out>/img/.
Usage: python build_data.py <output dir> [cache dir]
Items: news (per source id), uittips (Gastvrij Weert, next 7 days) and football highlight videos (YouTube channel feeds)."""
import hashlib, io, html, json, os, re, subprocess, sys, time
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

OUT_DIR = sys.argv[1] if len(sys.argv) > 1 else "public"
CACHE = sys.argv[2] if len(sys.argv) > 2 else ".cache"
OUT = os.path.join(OUT_DIR, "data.json")
IMG_DIR = os.path.join(OUT_DIR, "img")
os.makedirs(CACHE, exist_ok=True)
os.makedirs(IMG_DIR, exist_ok=True)
UA = "Mozilla/5.0 (Kiosk personal reader)"
M = "{http://search.yahoo.com/mrss/}"
CE = "{http://purl.org/rss/1.0/modules/content/}encoded"
NOW = time.time()
KEEP_HOURS = 72          # the page itself shows 48 hours; a little extra so a late refresh still fills sections
LOG = lambda *a: print(*a, file=sys.stderr)

MIDDEN = """weert nederweert roermond leudal heythuysen haelen horn roggel baexem neer buggenum grathem hunsel ittervoort
kelpen-oler nunhem heibloem maasgouw maasbracht thorn wessem heel linne stevensweert beegden panheel brachterbeek
echt-susteren echt susteren pey koningsbosch maria-hoop nieuwstadt roosteren roerdalen vlodrop odiliënberg herkenbosch
melick posterholt montfort stramproy ell swartbroek tungelroy altweerterheide laar leveroy ospel budschop midden-limburg""".split()
NU_SKIP = {"voetbal", "sport", "sport-overig", "sportvideos", "formule-1", "schaatsen", "darts", "tennis", "wielrennen", "games", "tech", "film", "muziek", "media", "entertainment", "achterklap", "economie"}
VIDEO_CHANNELS = [  # (source id, name, YouTube handle) with free official highlights
    ("yt-espn", "ESPN Nederland", "@ESPNNL"), ("yt-laliga", "LaLiga", "@LaLiga"),
    ("yt-lfc", "Liverpool FC", "@LiverpoolFC"), ("yt-fcb", "FC Barcelona", "@fcbarcelona"),
]


def get(url, binary=False, timeout=25):
    r = subprocess.run(["curl", "-sSL", "-m", str(timeout), "-A", UA, url], capture_output=True)
    if r.returncode:
        return None
    return r.stdout if binary else r.stdout.decode("utf-8", "ignore")


def clean(t):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", t or ""))).strip()


def short(t, n=240):
    return t if len(t) <= n else t[: n - 1].rsplit(" ", 1)[0] + "…"


def paras_from_html(h):
    h = re.sub(r"(?is)<(script|style|figure|figcaption|aside|iframe|noscript)\b.*?</\1>", "", h or "")
    out = []
    for tag, body in re.findall(r"(?is)<(p|h2|h3|li)\b[^>]*>(.*?)</\1>", h):
        t = clean(body)
        if len(t) > 1:
            out.append(("## " if tag.lower() in ("h2", "h3") else "• " if tag.lower() == "li" else "") + t)
    return out


def thumb(url):
    """Download, crop to 16:9 and store as img/<hash>.jpg; returns the relative path (cached across runs)."""
    if not url:
        return None
    name = hashlib.md5(url.encode()).hexdigest() + ".jpg"
    cached = os.path.join(CACHE, name)
    if not os.path.exists(cached):
        b = get(url, binary=True)
        if not b or len(b) < 500:
            return None
        try:
            im = Image.open(io.BytesIO(b)).convert("RGB")
            w, h = im.size
            tw = min(w, int(h * 16 / 9)); th = int(tw * 9 / 16)
            im = im.crop(((w - tw) // 2, (h - th) // 2, (w - tw) // 2 + tw, (h - th) // 2 + th)).resize((640, 360), Image.LANCZOS)
            im.save(cached, "JPEG", quality=70, optimize=True, progressive=True)
        except Exception:
            return None
    dest = os.path.join(IMG_DIR, name)
    if not os.path.exists(dest):
        with open(cached, "rb") as f, open(dest, "wb") as g:
            g.write(f.read())
    return "img/" + name


def rss(url):
    x = get(url)
    if not x or "<rss" not in x[:800]:
        LOG("  ! feed niet bereikbaar:", url)
        return []
    items = []
    for it in ET.fromstring(x.encode()).findall(".//item"):
        enc = it.find("enclosure")
        img = enc.get("url") if enc is not None else None
        if not img:
            mc = it.find(M + "content")
            img = mc.get("url") if mc is not None else None
        if not img:
            m = re.search(r'<img[^>]+src="([^"]+)"', (it.findtext(CE) or "") + (it.findtext("description") or ""))
            img = m.group(1) if m else None
        pub = parsedate_to_datetime(it.findtext("pubDate")).timestamp()
        if pub < NOW - KEEP_HOURS * 3600:
            continue
        items.append(dict(title=clean(it.findtext("title")), link=(it.findtext("link") or "").strip(),
                          intro=clean(it.findtext("description")), cats=[c.text.strip() for c in it.findall("category") if c.text],
                          pub=int(pub * 1000), premium=(it.findtext("premium") or "").strip().lower() == "true",
                          img_url=img, full=paras_from_html(it.findtext(CE))))
    return items


def finish(source_id, items, region=False):
    def enrich(i):
        i["img"] = thumb(i.pop("img_url"))
        return i
    with ThreadPoolExecutor(8) as ex:
        items = list(ex.map(enrich, items))
    for i in items:
        i["id"] = f"{source_id}-{hashlib.md5(i['link'].encode()).hexdigest()[:10]}"
        i["src"] = source_id
        i["cat"] = (i["cats"][0] if i["cats"] else "").capitalize()
        i["intro"] = short(i["intro"])
        if region:
            hay = " ".join(i["cats"] + [i["title"], i["link"]]).lower()
            i["midden"] = any(re.search(r"(?<![\w-])" + re.escape(p) + r"(?![\w-])", hay) for p in MIDDEN)
        if i["full"] and i["intro"] and i["full"][0].startswith(i["intro"][:50]):
            i["full"] = i["full"][1:]
        del i["cats"]
    LOG(f"  {source_id}: {len(items)} berichten, {sum(1 for i in items if i['img'])} met foto, "
        f"{sum(1 for i in items if i['full'])} met volledige tekst")
    return items


def news_sources():
    out = []
    nu, seen = [], set()
    for feed in ("Algemeen", "Binnenland", "Buitenland"):
        for i in rss("https://www.nu.nl/rss/" + feed):
            cats = {c.lower() for c in i["cats"]}
            if i["link"] in seen or cats & NU_SKIP:
                continue
            seen.add(i["link"]); nu.append(i)
    nu.sort(key=lambda i: -i["pub"])
    out += finish("nu", nu)
    out += finish("nu-eco", [i for i in rss("https://www.nu.nl/rss/Economie") if any(c.lower() == "economie" for c in i["cats"])])
    out += finish("nu-sport", [i for i in rss("https://www.nu.nl/rss/Sport") if not any(c.lower() == "sportvideos" for c in i["cats"])])
    lim = rss("https://www.limburger.nl/rss")
    is_sport = lambda i: any("sport" in c.lower() for c in i["cats"])
    is_eco = lambda i: any(c.lower() == "economie" for c in i["cats"])
    l_sport, l_eco = [i for i in lim if is_sport(i)], [i for i in lim if is_eco(i)]
    l_rest = [i for i in lim if i not in l_sport and i not in l_eco]
    out += finish("limburger", l_rest, region=True)
    out += finish("limburger-sport", l_sport)
    out += finish("limburger-eco", l_eco)
    out += finish("l1", rss("https://www.l1.nl/rss/nieuws.xml"), region=True)
    out += finish("wdg", rss("https://www.weertdegekste.nl/feed/"))
    out += finish("nw24", rss("https://www.nederweert24.nl/feed/"))
    return out


def uittips(days=7):
    fields = "id,link,title,begin-datum,eind-datum,aanvangstijd,meerdere-dagen,korte-omschrijving,omschrijving,toegangsprijs,featured_media,fifu_image_url,type-activiteit"
    first = get(f"https://gastvrijweert.nl/wp-json/wp/v2/type-activiteit?per_page=100&_fields=id,name") or "[]"
    themes = {t["id"]: html.unescape(t["name"]) for t in json.loads(first)}
    t2 = get(f"https://gastvrijweert.nl/wp-json/wp/v2/type-activiteit?per_page=100&page=2&_fields=id,name")
    try:
        themes.update({t["id"]: html.unescape(t["name"]) for t in json.loads(t2)})
    except Exception:
        pass
    urls = [f"https://gastvrijweert.nl/wp-json/wp/v2/activiteit?per_page=100&page={p}" for p in range(1, 21)]
    with ThreadPoolExecutor(6) as ex:
        pages = list(ex.map(get, urls))
    acts = []
    for p in pages:
        try:
            b = json.loads(p)
            if isinstance(b, list):
                acts += b
        except Exception:
            pass
    today = time.mktime(time.localtime(NOW)[:3] + (0, 0, 0, 0, 0, -1))
    sel = []
    for a in acts:
        try:
            start = int(a.get("begin-datum") or 0)
        except ValueError:
            continue
        if not start or start < today - 3600 * 2 or start > today + days * 86400:
            continue
        sel.append(a)
    # media urls in bulk
    ids = sorted({a["featured_media"] for a in sel if a.get("featured_media")})
    media = {}
    for k in range(0, len(ids), 100):
        x = get("https://gastvrijweert.nl/wp-json/wp/v2/media?per_page=100&_fields=id,source_url,media_details&include=" + ",".join(map(str, ids[k:k + 100])))
        try:
            for m in json.loads(x):
                s = (m.get("media_details") or {}).get("sizes") or {}
                media[m["id"]] = (s.get("medium_large") or s.get("large") or s.get("medium") or {}).get("source_url") or m["source_url"]
        except Exception:
            pass

    def enrich(a):
        page = get(a["link"]) or ""
        m = re.search(r'data-id="949e2ee".*?__content"\s*>([^<]+)<', page, re.S)
        desc = re.sub(r"(?i)<br\s*/?>|</p>", "\n", a.get("omschrijving") or "")
        full = [p for p in (clean(l) for l in desc.split("\n")) if p]
        th = [themes.get(t) for t in a.get("type-activiteit") or [] if themes.get(t)]
        th = [t for t in th if t not in ("Uitgelicht",)]
        return dict(id="uit-" + str(a["id"]), src="gastvrij", title=clean(a["title"]["rendered"]), link=a["link"],
                    intro=short(clean(a.get("korte-omschrijving") or "")), full=full, org=clean(m.group(1)) if m else "",
                    start=int(a["begin-datum"]), time=a.get("aanvangstijd") or "", price=a.get("toegangsprijs") or "",
                    themes=th[:3], cat=(th[0] if th else "Uittip"),
                    img=thumb(media.get(a.get("featured_media")) or a.get("fifu_image_url")))
    with ThreadPoolExecutor(8) as ex:
        items = list(ex.map(enrich, sel))
    items.sort(key=lambda i: (i["start"], i["time"]))
    LOG(f"  gastvrij: {len(acts)} activiteiten bekeken, {len(items)} uittips in 7 dagen, "
        f"{sum(1 for i in items if i['org'])} met organisator, {sum(1 for i in items if i['themes'])} met thema")
    return items


def videos():
    out = []
    for sid, name, handle in VIDEO_CHANNELS:
        page = get(f"https://www.youtube.com/{handle}")
        m = re.search(r'<link rel="canonical" href="https://www.youtube.com/channel/(UC[\w-]{22})"', page or "") \
            or re.search(r'"externalId":"(UC[\w-]{22})"', page or "")
        if not m:
            LOG(f"  ! YouTube niet bereikbaar voor {name}")
            continue
        x = get(f"https://www.youtube.com/feeds/videos.xml?channel_id={m.group(1)}")
        if not x:
            continue
        ns = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015", "media": "http://search.yahoo.com/mrss/"}
        for e in ET.fromstring(x.encode()).findall("a:entry", ns):
            title = e.findtext("a:title", "", ns)
            if not re.search(r"(?i)samenvatting|highlights|resumen|hoogtepunten", title):
                continue
            if re.search(r"(?i)#shorts|throwback|\b(19|20)\d\d/\d\d\b|women|vrouwen|femen", title):
                continue
            vid = e.findtext("yt:videoId", "", ns)
            pub = parsedate_to_datetime(e.findtext("a:published", "", ns).replace("T", " ").replace("+00:00", " +0000")).timestamp() \
                if False else time.mktime(time.strptime(e.findtext("a:published", "", ns)[:19], "%Y-%m-%dT%H:%M:%S"))
            if pub < NOW - 10 * 86400:
                continue
            out.append(dict(id="v-" + vid, src=sid, channel=name, title=title, link=f"https://www.youtube.com/watch?v={vid}",
                            pub=int(pub * 1000), img=thumb(f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg")))
    LOG(f"  video: {len(out)} samenvattingen")
    return out


if __name__ == "__main__":
    data = {"fetched": int(NOW * 1000), "items": news_sources() + uittips(), "videos": videos()}
    # If a source came back empty (site hiccup, rate limit), keep its previous items instead of losing them.
    try:
        prev = json.load(open(os.path.join(CACHE, "previous.json")))
        have = {i["src"] for i in data["items"]}
        kept = [i for i in prev.get("items", []) if i["src"] not in have and (i.get("start") or i.get("pub", 0) >= (NOW - KEEP_HOURS * 3600) * 1000)]
        if kept:
            LOG(f"  vorige berichten behouden voor: {sorted({i['src'] for i in kept})}")
            data["items"] += kept
        if not data["videos"]:
            data["videos"] = prev.get("videos", [])
    except Exception:
        pass
    used = {i["img"] for i in data["items"] + data["videos"] if i.get("img")}
    for f in os.listdir(IMG_DIR):  # drop thumbnails that are no longer referenced
        if "img/" + f not in used:
            os.remove(os.path.join(IMG_DIR, f))
    json.dump(data, open(OUT, "w"), ensure_ascii=False)
    json.dump(data, open(os.path.join(CACHE, "previous.json"), "w"), ensure_ascii=False)
    LOG("geschreven:", OUT, os.path.getsize(OUT) // 1024, "KB")
