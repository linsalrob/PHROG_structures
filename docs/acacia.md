# Serving the gallery assets from Acacia

The gallery's images and structures are served from a public, read-only bucket on Pawsey's
Acacia object store. GitHub Pages serves only the small front end: `index.html`,
`manifest.json` and `images/not_available.png`, about 350 KB in all. Before this change,
GitHub Pages served the images from the repository, and production's Pages artifact was 3.56 GB.
That was enough for deploys to time out (production run
[42740727687](https://github.com/linsalrob/PHROG_structures/actions/runs/42740727687),
2026-11-10).

## Where things are

| | |
|---|---|
| Public bucket | `phrogstructures-public` (rclone remote `A18`) |
| Public URL | `https://projects.pawsey.org.au/phrogstructures-public/<key>` |
| Object keys | the repository paths, e.g. `png/phrog_005/phrog_00505.png`, `oligomer_pdb/phrog_005/phrog_00505.pdb.gz`, `montage/phrog_005_montage.png` |
| Checksums | `SHA256SUMS` at the bucket root |
| Index used by the site | `manifest.json` in this repository |
| Source bucket | `phrogstructures` (private, unchanged) |

The site builds every asset URL from `ASSET_BASE` in `index.html`, so moving the bucket
means changing that one line.

The bucket is publicly readable through a bucket policy (see below), not through `rclone link`
URLs, which expire after at most seven days.

## How the bucket was built and checked (2026-11-10)

The counts and checks below are also in [`audit-2026-11-10.json`](audit-2026-11-10.json).

The reference is the production branch `linsalrob/PHROG_structures@oligomers`, commit
`f450191`. Its file list (paths, sizes and git blob hashes) and its git-lfs pointers (SHA-256
OIDs and sizes) were read through the GitHub API and a partial clone of blobs under 1 KB. No
git-lfs content was downloaded from GitHub.

1. **Reconcile.** Every production asset was matched with an object in the private
   `phrogstructures` bucket by path and size. The oligomer folders there follow no single
   naming rule (`phrog_00011/`, `phrog_00100/` holding `phrog_01000`–`01009`, `phrog_3.2/`),
   but every oligomer filename is unique, so oligomers were matched by filename.
2. **Checksum.** All 130,362 matched objects were downloaded from Acacia and hashed: `.pdb.gz`
   files against their git-lfs SHA-256 OIDs, PNGs against their git blob SHA-1s. There were no
   mismatches.
3. **Copy.** Only verified objects were copied, server side, into `phrogstructures-public` at
   their production paths. Oligomer objects were regrouped into `phrog_NNN/` folders.
4. **Fill gaps.** Three directories were missing or out of date in `phrogstructures` and were
   uploaded from a hash-checked sparse checkout of production:
   - `montage/`: 389 files. The bucket held the version from commit `3e8fea0`; production
     replaced it in `23c33b6`.
   - `oligomer_montage/`: 389 files, missing.
   - `oligomer_thumbnails/`: 6,900 files, missing.
5. **Final check.** The bucket listing was compared with the expected file set, using each
   object's size and MD5 ETag. `SHA256SUMS` was written from the verified hashes.

Some objects in `phrogstructures` were not copied: `.git/` (a 6.6 GB copy of an old checkout,
including its git-lfs store), `cxc/` (ChimeraX scripts), `pngc/` (a duplicate of `png/`) and
the root files.

### Contents

| Directory | Files | Size |
|---|---:|---:|
| `pdb/` | 38,853 | 926 MB |
| `png/` | 38,853 | 1,796 MB |
| `thumbnails/` | 38,853 | 222 MB |
| `montage/` | 389 | 702 MB |
| `oligomer_pdb/` | 6,902 | 444 MB |
| `oligomer_png/` | 6,902 | 651 MB |
| `oligomer_thumbnails/` | 6,901 | 59 MB |
| `oligomer_montage/` | 389 | 190 MB |

### Exceptions

- **`phrog_00003` (oligomer).** In production its PNG is filed in a stray folder,
  `oligomer_png/phrog_3.2/`, and it has no thumbnail, so the gallery never showed it. The
  public bucket also has the PNG at `oligomer_png/phrog_000/phrog_00003.png`. A thumbnail
  was made with `magick <png> -resize 100x100 <thumbnail>`, the method in `DEVELOPER.md`.
  Rebuilding an existing thumbnail (`phrog_00006`) this way reproduced it exactly.
- **`phrog_25222` (oligomer).** It has a structure but no PNG or thumbnail, in production or on
  Acacia. The gallery says so and still offers the download.

## Public read access

The policy is the one in Pawsey's
[pshell and S3 remotes](https://pawsey.atlassian.net/wiki/spaces/US/pages/51926450/pshell%2Band%2BS3%2Bremotes)
guide (Example 4). It grants anonymous `s3:GetObject` and `s3:ListBucket` on this bucket only.
Writes and deletes still need the owner's keys. It was applied on 2026-11-10 and checked
anonymously with `curl`:

| Check | Result |
|---|---|
| GET of 10 sample objects (monomer and oligomer `.pdb.gz`, PNGs, thumbnails, montages, both `phrog_00003` fixes, `phrog_25222`) | 200; all match `SHA256SUMS` |
| Content types | `image/png`, `application/gzip` |
| PUT of a new key | 403 |
| DELETE of a key that does not exist | 403 |
| LIST of the bucket | 403. Acacia does not honour `s3:ListBucket` for anonymous users, so the README uses `SHA256SUMS` as the file list. |
| Source bucket `phrogstructures` | still 403 |

```
module load pshell/1.2.2
pshell
remote acacia s3 https://projects.pawsey.org.au
login                                    # Acacia access and secret key
policy phrogstructures-public +r *
info phrogstructures-public
```

To withdraw public access: `policy phrogstructures-public - *`.

Plain `<img>` tags and download links do not need CORS. The site's only scripted request is for
`manifest.json`, which is on the same origin.

## Adding or changing assets

1. Upload new or changed files to `phrogstructures-public` at their repository paths, e.g.
   `rclone copy png/phrog_389 A18:phrogstructures-public/png/phrog_389`.
2. Regenerate the manifest and commit it:
   ```
   rclone lsf -R --files-only A18:phrogstructures-public > listing.txt
   scripts/build_manifest.py listing.txt > manifest.json
   ```
3. Add the new files' checksums to `SHA256SUMS` and upload it.
4. If the PHROG range grows past `phrog_388`, update `NGROUPS` and `MAX_PHROG` in `index.html`.
   Also update `NGROUPS` in `scripts/build_manifest.py`.

## GitHub Pages deployment

`.github/workflows/pages.yml` runs `npm test` and then `scripts/stage_site.sh`. The script
copies an allowlist of files into `_site/`. It fails if the result is larger than 5 MB, or
contains PNG, PDB or `.gz` files outside `images/`, or contains git-lfs pointers. On a push to
the site branch (`main` in PHROG_structures_dev, `oligomers` in PHROG_structures), `_site/` is
deployed with `actions/deploy-pages`. Pull requests run only the build and checks.

The checkout is sparse and blobless, so CI fetches only the front end even if a branch holds
data directories.

This requires **Settings → Pages → Source = GitHub Actions**. With "Deploy from a branch",
GitHub publishes the whole branch.

## git-lfs

PHROG_structures_dev no longer uses git-lfs. After the Acacia-backed site was checked in a
browser (2026-11-10: images load from `projects.pawsey.org.au`), its sample data directories
and `.gitattributes` rules were removed. Earlier commits still point at their LFS objects, so
this does not by itself reduce GitHub LFS storage; that needs the objects deleted on GitHub.

## Production cutover (2026-11-10)

Production was moved over in two stages.

1. **Front end.** `index.html`, `manifest.json`, the tests, scripts, docs and
   `.github/workflows/pages.yml` (with `main` replaced by `oligomers`) were copied to
   `oligomers` with `scripts/push_to_branch.sh`, and Settings → Pages → Source was set to GitHub
   Actions. The first deploy published 349,782 bytes.
2. **Data and git-lfs removed.** GitHub frees LFS storage only when a repository is deleted, so:
   - the old repository was renamed to
     [`linsalrob/PHROG_structures_archive`](https://github.com/linsalrob/PHROG_structures_archive)
     and archived. It keeps the full history, the data directories, every LFS object, the
     stars, the `Vini2` fork and the Zenodo webhook;
   - its history was rewritten with `git filter-repo --refs main..oligomers --invert-paths
     --prune-empty never` (paths `png/`, `thumbnails/`, `pdb/`, `montage/`, the four
     `oligomer_*` directories and `.gitattributes`). All 2,033 commits, authors, dates and
     messages are kept; `main` (`494c4e3`) and tag `v0.1` (`2656b5e`) are unchanged, with their
     signatures. The tip tree is identical to the archive's apart from the data. The repository
     is 1.7 MB instead of 6.7 GB plus about 1.4 GB of LFS objects;
   - `main`, `oligomers` and `v0.1` were pushed to a new `linsalrob/PHROG_structures`. The
     `v0.1` release was recreated, and Pages deploys from `oligomers` through the workflow
     (the `github-pages` environment allows `oligomers`).

LFS storage is charged until the archive is deleted, and the monthly figure resets on the first
of the following month. Re-enable the Zenodo GitHub integration on the new repository before the
next release.

**Rollback:** the archive still holds the old site. Delete or rename the new repository, rename
the archive back to `PHROG_structures`, unarchive it and redeploy. Once the archive is deleted,
the only copies of the data are the current versions in `phrogstructures-public` (see above);
earlier versions of files are gone.
