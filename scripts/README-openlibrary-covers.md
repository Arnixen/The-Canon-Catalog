# Open Library book-cover workflow

This resolver looks up published-book rows through Open Library's public search API and writes a remote cover URL into the existing `poster` column. It runs locally, requires no API key, and does not make book-database requests from the public site.

The script targets rows whose `type` contains `Novel`, `Book`, or `Prose`. If a row has a `library url`, `open library url`, or `openlibrary url` column, that URL is resolved first. Open Library work, edition, ISBN, and direct cover URLs are supported. Rows without a usable URL fall back to title and release-date matching. Existing poster values are preserved by default.

## Preview and review

```powershell
python scripts/generate_openlibrary_covers.py
```

Review `openlibrary_cover_suggestions.csv` and `openlibrary_cover_suggestions.json`. Rows marked `matched` are higher-confidence title/year matches; rows marked `review` need manual verification.

## Write cover URLs

```powershell
python scripts/generate_openlibrary_covers.py --write-posters
```

The script creates a `.bak` workbook backup before the first write. Use `--overwrite` only when intentionally replacing existing covers:

```powershell
python scripts/generate_openlibrary_covers.py --write-posters --overwrite
```

Generated URLs use Open Library's cover service, for example:

```text
https://covers.openlibrary.org/b/id/8231856-L.jpg
```

Review workbook changes before publishing. Cover availability and edition matching can vary, especially for books with multiple editions.