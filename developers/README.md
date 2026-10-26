# PCB Developers

Static website for the PCB Developers team: a directory of programmers, their projects, and a media gallery. Data is stored in Supabase; the site is plain HTML/CSS/JS with no build step.

## Live site

Hosted with GitHub Pages at `https://<your-username>.github.io/PCB-Developers/` (see *Publishing* below).

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Full page markup + inline admin/CRUD logic |
| `styles.css` | Styling |
| `LOGO6.png` | Logo shown in the navbar |
| `Prompt.txt` | Supabase schema + RLS policies (run in the SQL editor) |
| `temp_check.js` | Older standalone copy of the script; not used by `index.html` |

## Run locally

Open `index.html` in a browser, or serve the folder:

```powershell
python -m http.server 8000
```

## Publishing (GitHub Pages)

1. Create an empty repository on GitHub (e.g. `PCB-Developers`, public).
2. Upload `index.html`, `styles.css`, `LOGO6.png`, `README.md` and `Prompt.txt` to the repo root.
3. In the repo go to **Settings → Pages**, set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`, and save.
4. The site goes live at `https://<your-username>.github.io/PCB-Developers/` within a minute.

`index.html` uses only relative asset paths, so it works from the repo root without any configuration.

## Security note

Before making the repo public, note that `index.html` contains a hardcoded admin password (`admin123`) and the Supabase URL + anon key, and the RLS policies in `Prompt.txt` currently allow public insert/update/delete. That means anyone visiting the live site can read, change, or delete the data. Replace the client-side password check with proper Supabase Auth, and restrict the RLS policies to authenticated writes.
