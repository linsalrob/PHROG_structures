#!/usr/bin/env python3
"""Build manifest.json, the site's index of which assets exist in the public Acacia bucket.

Usage:
    rclone lsf -R --files-only A18:phrogstructures-public > listing.txt
    scripts/build_manifest.py listing.txt > manifest.json

For each mode (monomers, oligomers) and asset type (png, thumbnails, pdb), the manifest holds one
25-character hex string per group phrog_000..phrog_388: bit i (i = 0..99, most significant bit of
the first hex digit first) is set when PHROG <group>*100 + i has that asset. `montage` lists the
group numbers that have a montage image.
"""
import datetime
import json
import re
import sys

NGROUPS = 389
DIRS = {
    "monomers": {"png": "png", "thumbnails": "thumbnails", "pdb": "pdb", "montage": "montage"},
    "oligomers": {"png": "oligomer_png", "thumbnails": "oligomer_thumbnails", "pdb": "oligomer_pdb",
                  "montage": "oligomer_montage"},
}
MEMBER = re.compile(r"^([a-z_]+)/phrog_(\d{3})/phrog_(\d{3})(\d{2})\.(png|pdb\.gz)$")
MONTAGE = re.compile(r"^([a-z_]+)/phrog_(\d{3})_montage\.png$")


def main(listing):
    owner = {d: (mode, kind) for mode, kinds in DIRS.items() for kind, d in kinds.items()}
    bits = {mode: {k: [0] * NGROUPS for k in ("png", "thumbnails", "pdb")} for mode in DIRS}
    montage = {mode: set() for mode in DIRS}
    skipped = 0
    for key in open(listing).read().split():
        m, mm = MEMBER.match(key), MONTAGE.match(key)
        if m and m.group(1) in owner and owner[m.group(1)][1] != "montage":
            top, group, group2, member, _ = m.groups()
            if group == group2 and int(group) < NGROUPS:
                mode, kind = owner[top]
                bits[mode][kind][int(group)] |= 1 << (99 - int(member))
                continue
        elif mm and mm.group(1) in owner and owner[mm.group(1)][1] == "montage" and int(mm.group(2)) < NGROUPS:
            montage[owner[mm.group(1)][0]].add(int(mm.group(2)))
            continue
        skipped += 1
    manifest = {
        "generated": datetime.date.today().isoformat(),
        "groups": NGROUPS,
        "modes": {
            mode: {**{k: [f"{v:025x}" for v in bits[mode][k]] for k in bits[mode]},
                   "montage": sorted(montage[mode])}
            for mode in DIRS
        },
    }
    counts = {mode: {k: sum(bin(v).count("1") for v in bits[mode][k]) for k in bits[mode]} for mode in DIRS}
    print(f"counts {counts}; montages {({m: len(v) for m, v in montage.items()})}; skipped {skipped} keys",
          file=sys.stderr)
    json.dump(manifest, sys.stdout, separators=(",", ":"))
    sys.stdout.write("\n")


if __name__ == "__main__":
    main(sys.argv[1])
