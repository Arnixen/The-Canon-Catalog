# TMDB poster workflow

The public page no longer contains a TMDB token. TMDB poster URLs are populated locally from the IDs/directories already in the workbooks.

## Set the token locally

PowerShell:

```powershell
$env:TMDB_API_TOKEN = "your-tmdb-read-access-token"
```

The token is never written to `index.html` or a workbook.

## Preview coverage

```powershell
python3.13 scripts/populate_tmdb_posters.py
```

This performs no workbook writes. It checks rows with TMDB references and reports how many have usable TMDB posters.

## Write remote poster URLs

```powershell
python3.13 scripts/populate_tmdb_posters.py --write-posters
```

The script writes values like this to the `poster` column:

```text
https://image.tmdb.org/t/p/w500/example.jpg
```

The page loads absolute poster URLs directly. Existing local poster filenames continue to work. A `.bak` workbook backup is created before the first write.

Use `--overwrite` only when intentionally replacing existing posters:

```powershell
python3.13 scripts/populate_tmdb_posters.py --write-posters --overwrite
```
Use `--overwrite` for season rows whose current poster is a whole-series image. The script recognizes TMDB directory values such as `91363-what-if/season/1`, fetches the season artwork, and writes the season-specific remote URL.

After reviewing the workbook changes:

```powershell
git add index.html scripts/populate_tmdb_posters.py scripts/README-tmdb-posters.md *.xlsx
 git commit -m "Use offline TMDB poster population"
git push origin main
```

TMDB attribution is displayed on the public page. This project should remain within TMDB's non-commercial API terms unless you obtain a commercial license.
