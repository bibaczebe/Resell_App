# Prompt dla Claude.ai (Web) – automatyczny setup workflow LootAlert w n8n

> Wklej poniższy prompt do okna czatu w **claude.ai** (web) gdzie masz już
> aktywny **n8n connector**. Claude AI z dostępem do Twojego n8n MCP odpali
> wszystkie kroki sam, bez Twojego klikania.

---

## PROMPT DO WKLEJENIA

```
Cześć! Jestem właścicielem n8n na kbalucki.app.n8n.cloud.
Połączyłem cię z moim n8n przez MCP. Twoja misja:

1. Sprawdź czy istnieje workflow o nazwie "LootAlert - Vinted Scraper".
   Jeśli istnieje – usuń go (DELETE) bo musimy go zastąpić poprawioną wersją.

2. Stwórz NOWY workflow z poniższym JSON i aktywuj go (toggle on).
   Gdy n8n nie pozwala na bezpośredni import JSON przez API – użyj kolejnych
   wywołań create-node + connect.

   JSON workflowu (tylko do referencji, podstaw te node'y):

   - Schedule Trigger "Every 2 min": typ schedule, interval 2 min
   - HTTP Request "Fetch Active Alerts": GET
       https://resellapp-production.up.railway.app/api/webhook/alerts
       Header: X-Webhook-Secret = lootalert-n8n-2026
   - Split Out "Split per Alert": fieldToSplitOut = alerts
   - Code "Only Vinted Alerts" (n8n-nodes-base.code, v2):
       const out = [];
       for (const item of $input.all()) {
         const sources = item.json.sources || [];
         if (Array.isArray(sources) && sources.includes('vinted')) {
           out.push(item);
         }
       }
       return out;
   - Code "Build Vinted URL":
       const alert = $json;
       const params = new URLSearchParams();
       params.set('search_text', alert.keywords);
       params.set('per_page', '25');
       params.set('order', 'newest_first');
       if (alert.max_price) params.set('price_to', String(alert.max_price));
       if (alert.min_price) params.set('price_from', String(alert.min_price));
       const targetUrl = 'https://www.vinted.pl/api/v2/catalog/items?' + params.toString();
       const scraperUrl = 'https://api.scraperapi.com/?api_key=4b75954442f7f8b52ff32e81817e1686&url=' + encodeURIComponent(targetUrl);
       return [{ json: { ...alert, _target_url: targetUrl, _scraper_url: scraperUrl } }];
   - HTTP Request "Scrape Vinted via ScraperAPI":
       URL = {{ $json._scraper_url }}
       Header: Accept = application/json
       Options: allowUnauthorizedCerts = true, timeout = 30000
   - Code "Format for LootAlert":
       const alertItem = $('Build Vinted URL').first();
       const alert = alertItem ? alertItem.json : {};
       const response = $input.first()?.json;
       const items = (response && response.items) || [];
       const listings = items.map(i => ({
         id: String(i.id || ''),
         title: i.title || '',
         price: parseFloat((i.price && i.price.amount) || 0) || null,
         url: (i.url || '').startsWith('http') ? i.url : 'https://www.vinted.pl' + (i.url || ''),
         image_url: (i.photo && i.photo.url) || null,
         source: 'vinted'
       })).filter(l => l.id);
       return [{ json: { alert_id: alert.id, listings } }];
   - HTTP Request "POST to LootAlert":
       Method = POST
       URL = https://resellapp-production.up.railway.app/api/webhook/n8n/listings
       Headers: X-Webhook-Secret = lootalert-n8n-2026, Content-Type = application/json
       Body (JSON): {{ JSON.stringify($json) }}

   Połączenia:
   Every 2 min → Fetch Active Alerts → Split per Alert → Only Vinted Alerts
   → Build Vinted URL → Scrape Vinted → Format → POST to LootAlert

3. Zapisz workflow i aktywuj go.

4. Wykonaj go ręcznie raz (Execute) i sprawdź:
   - Czy każdy węzeł zwrócił success
   - Pokaż mi response z ostatniego węzła "POST to LootAlert" (powinien być
     JSON {"received": N, "new": M, "notifications_sent": K})

5. Po sukcesie – stwórz drugi workflow "LootAlert - eBay Scraper" wzorowany
   na Vinted, z tymi różnicami:
   - Filter: sources.includes('ebay')
   - Build URL Code:
       const alert = $json;
       const targetUrl = 'https://api.ebay.com/buy/browse/v1/item_summary/search?q=' + encodeURIComponent(alert.keywords) + '&limit=25';
       return [{ json: { ...alert, _target_url: targetUrl } }];
   - HTTP Request "Scrape eBay":
       URL = {{ $json._target_url }}
       Header: Authorization = Bearer EBAY_TOKEN_TUTAJ
       Header: X-EBAY-C-MARKETPLACE-ID = EBAY_US
   - Format Code:
       const items = ($input.first()?.json?.itemSummaries) || [];
       const listings = items.map(i => ({
         id: String(i.itemId || ''),
         title: i.title || '',
         price: parseFloat((i.price && i.price.value) || 0) || null,
         url: i.itemWebUrl || '',
         image_url: (i.image && i.image.imageUrl) || null,
         source: 'ebay_us'
       })).filter(l => l.id);
       return [{ json: { alert_id: $('Build eBay URL').first().json.id, listings } }];

6. Zwróć mi raport: który workflow działa, ile alertów było aktywnych, ile
   listingów znalezionych.
```

---

## Notatki dla użytkownika:

- **EBAY_TOKEN_TUTAJ** zastąp aktualnym tokenem z developer.ebay.com
  (User Tokens → OAuth, Sign in to Production for OAuth → Copy Token).
  Token wygasa po 2h, więc po jego wygaśnięciu Claude Web może go odświeżyć
  jeśli dostarczysz mu Cert ID.

- Jeśli Claude.ai Web nie ma dostępu do tworzenia node'ów programowo,
  możesz mu poprosić o **wygenerowanie identycznego JSON i wklejenia ich
  do n8n przez Import** - n8n connector zwykle ma operację `import_workflow`
  lub `create_workflow_from_json`.

- Nazwy node'ów MUSZĄ pasować dokładnie – kod używa `$('Build Vinted URL')`
  i `$('Build eBay URL')` żeby pobrać alert ID po HTTP request.
