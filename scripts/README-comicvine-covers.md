# Comic Vine cover workflow

This resolver keeps the Comic Vine API key off the public site. It reads comic rows from the workbooks, resolves either explicit Comic Vine IDs/directories or title-based suggestions, and can write Comic Vine's remote cover URL into each row's `poster` column. The repository does not store the cover image files.

## 1. Set the key locally

PowerShell:

```powershell
$env:COMIC_VINE_API_KEY = "your-key-here"
```

The key is read from the environment and is never written to a workbook or `index.html`.

## 2. Add explicit Comic Vine IDs or directories

The script recognizes these optional column names, case-insensitively:

- `comic vine directory`
- `comic vine id`
- `comic vine url`

A directory can be a full URL such as `https://comicvine.gamespot.com/issue/4000-12345/` or a numeric ID. Existing `poster` values are preserved by default.

## 3. Generate suggestions first

This makes API requests and writes only review files:

```powershell
python scripts/generate_comicvine_covers.py
```

Review:

- `comicvine_cover_suggestions.csv`
- `comicvine_cover_suggestions.json`

Rows with an existing poster are skipped unless `--overwrite` is supplied.

## 4. Write remote cover URLs into workbooks

After reviewing the suggestions, run:

```powershell
python scripts/generate_comicvine_covers.py --write-posters
```

The script creates a `.bak` copy before changing a workbook. It writes remote poster values such as:

```text
https://comicvine.gamespot.com/a/uploads/scale_large/...
```

The existing site recognizes absolute `http`/`https` poster values and loads them directly. Local poster filenames continue to work as before. No `index.html` Comic Vine code or public API key is needed.

Use `--overwrite` only when you intentionally want to replace existing poster values:

```powershell
python scripts/generate_comicvine_covers.py --write-posters --overwrite
```

## 5. Publish

Review the workbook diff and downloaded images before pushing:

```powershell
git status
git diff --stat
git add *.xlsx
git commit -m "Add Comic Vine comic covers"
git push origin main
```

Temporary Excel lock files such as `~$MCU.xlsx` should not be added.

## No-API page lookup

For the Star Wars `CANON` sheet, `scripts/populate_comicvine_posters.py` can read
the existing Comic Vine issue URLs and extract the public page's `og:image`
value without making Comic Vine API requests:

```powershell
python scripts/populate_comicvine_posters.py
python scripts/populate_comicvine_posters.py --write-posters
```

The first command is a dry run. Existing poster values are preserved unless
`--overwrite` is supplied. A `.bak` copy is created before the first workbook
write.

Comic Vine may return Cloudflare HTTP 403 responses to non-browser requests.
When that happens, this resolver reports the affected rows and does not write
them; it requires a browser-capable environment or a permitted alternate data
source for those pages.
