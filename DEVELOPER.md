# How we create these files.

First, we use colabfold to create the `.pdb` files, and PHLEGM to figure out whether they should be oligomers.

## Create the png files.

We use [ChimeraX](https://www.rbvi.ucsf.edu/chimerax/) to create the png files. For each pdb file, we create a `.cxc` file with this content:

```
open pdb/phrog_025/phrog_02522.pdb.gz
color bfactor palette alphafold
set bgColor white
view
save png/phrog_025/phrog_02522.png  width 512 supersample 3
close all
```

(Actually, we make just a few `.cxc` files, with lots of those commands concatenated one after the other).

Then, we render the images using ChimeraX on an Ubuntu 22.04 system.

```
chimerax --offscreen --nogui --exit render.cxc
```


# Create the thumbnail files

We use imagemagick to make the thumbnail files:


```
convert "png/phrog_025/phrog_02522.png" -resize 100x100 "thumbnails/phrog_025/phrog_02522.png"
```

# Next we montage all the png files

Again, using imagemagick:


