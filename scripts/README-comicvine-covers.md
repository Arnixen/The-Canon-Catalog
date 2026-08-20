# Comic Vine cover workflow

This resolver keeps the Comic Vine API key off the public site. It reads comic rows from the workbooks, looks up each row's exact Comic Vine issue ID, and writes Comic Vine's remote cover URL into the row's `poster` column. The repository does not store the cover image files.

## 1. Set the key locally

PowerShell:

```powershell
$env:COMIC_VINE_API_KEY = "your-key-here"
```

The key is read from the environment and is never written to a workbook or `index.html`.

## 2. Ensure rows have a Comic Vine issue ID

The script reads the `comic vine id` column. If rows only have a `comic vine url`, run `scripts/extract_comicvine_ids.py` first to populate the ID column without any network requests:

```powershell
python scripts/extract_comicvine_ids.py --write
```

## 3. Preview coverage

```powershell
python scripts/populate_comicvine_posters_from_ids.py --api-key $env:COMIC_VINE_API_KEY
```

This performs no workbook writes. It reports how many rows have a resolvable Comic Vine cover.

## 4. Write remote cover URLs into workbooks

```powershell
python scripts/populate_comicvine_posters_from_ids.py --api-key $env:COMIC_VINE_API_KEY --write-posters
```

The script creates a `.bak` copy before changing a workbook. It writes remote poster values such as:

```text
https://comicvine.gamespot.com/a/uploads/scale_small/...
```

The existing site recognizes absolute `http`/`https` poster values and loads them directly. Local poster filenames continue to work as before. No `index.html` Comic Vine code or public API key is needed.

Use `--overwrite` only when you intentionally want to replace existing poster values:

```powershell
python scripts/populate_comicvine_posters_from_ids.py --api-key $env:COMIC_VINE_API_KEY --write-posters --overwrite
```

The script respects Comic Vine's rate limit with `--delay` and `--max-requests-per-hour`; defaults keep requests under 200/hour.

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
