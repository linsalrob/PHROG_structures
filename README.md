# PHROG_structures

Structures for representatives of all the PHROG protein clusters.

These structures were created by Susie Grigson at Flinders University using resources from Flinders University, Pawsey Supercomputer Centre, and NCI Supercomputer Centre. Please contact Susie for appropriate attribution, and cite the dataset using [`citation.cff`](citation.cff) ([doi:10.5281/zenodo.15825637](https://doi.org/10.5281/zenodo.15825637)).

Please [see the website](https://linsalrob.github.io/PHROG_structures/) for the interactive version.

## Downloading the data

The images and structures are served from Pawsey's [Acacia](https://pawsey.org.au/systems/acacia/) object store, in a public, read-only bucket. No account or git-lfs is needed. Every file has a stable URL:

```
https://projects.pawsey.org.au/phrogstructures-public/<path>
```

PHROGs are stored in groups of 100, so PHROG 505 is in `phrog_005/`:

| Path | Contents |
|---|---|
| `pdb/phrog_005/phrog_00505.pdb.gz` | monomer structure |
| `png/phrog_005/phrog_00505.png` | monomer image (512px) |
| `thumbnails/phrog_005/phrog_00505.png` | monomer thumbnail (100px) |
| `montage/phrog_005_montage.png` | montage of the monomers in a group |
| `oligomer_pdb/`, `oligomer_png/`, `oligomer_thumbnails/`, `oligomer_montage/` | the same for oligomers |
| `SHA256SUMS` | SHA-256 checksums for every file |

For example:

```
curl -O https://projects.pawsey.org.au/phrogstructures-public/pdb/phrog_005/phrog_00505.pdb.gz
wget https://projects.pawsey.org.au/phrogstructures-public/oligomer_pdb/phrog_005/phrog_00505.pdb.gz
```

To download everything (about 5 GB), use `SHA256SUMS` as the list of files, then check the downloads against it. The bucket cannot be listed anonymously.

```
B=https://projects.pawsey.org.au/phrogstructures-public
mkdir phrog_structures && cd phrog_structures
curl -O $B/SHA256SUMS
awk -v b=$B '{print b "/" $2}' SHA256SUMS | wget -x -nH --cut-dirs=1 -i -
sha256sum -c SHA256SUMS
```

Use `grep` on `SHA256SUMS` first to download a subset, e.g. `grep ' oligomer_pdb/' SHA256SUMS`.

[`manifest.json`](manifest.json) lists which structures exist for each PHROG. See [docs/acacia.md](docs/acacia.md) for how the data are published and checked.
