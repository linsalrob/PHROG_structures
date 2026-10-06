#!/bin/bash
#SBATCH --job-name=montage
#SBATCH --time=0-1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=1
#SBATCH --mem=2G
#SBATCH -o mont-%A_%a.out
#SBATCH -e mont-%A_%a.err

eval "$(conda shell.bash hook)"
conda activate imagemagick


DIR=$(head -n $SLURM_ARRAY_TASK_ID dirs  | tail -n 1)

montage $(for f in oligomer_png/$DIR/*.png; do echo -label $(echo $f | perl -ne 'm#phrog_(\d+).png#; print "$1\n"') "$f"; done) oligomer_montage/${DIR}_montage.png


