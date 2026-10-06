#!/bin/bash
#SBATCH --job-name=thumbnails
#SBATCH --time=0-1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=1
#SBATCH --mem=2G
#SBATCH -o thumb-%A_%a.out
#SBATCH -e thumb-%A_%a.err

eval "$(conda shell.bash hook)"
conda activate imagemagick

DIR=$(head -n $SLURM_ARRAY_TASK_ID dirs  | tail -n 1)

mkdir -p oligomer_thumbnails/$DIR/; 
for img in oligomer_png/$DIR/*png; do
	base=$(basename "$img");
	convert "$img" -resize 100x100 "oligomer_thumbnails/$DIR/$base";
done

git add oligomer_png/$DIR/* oligomer_thumbnails/$DIR/*
git commit -m 'updating images' oligomer_png/$DIR/*
git commit -m 'updating thumbnails' oligomer_thumbnails/$DIR/*


if (( SLURM_ARRAY_TASK_ID % 10 == 0 )); then
    lockdir="/tmp/git_push_lock"

    # Wait for lock
    while ! mkdir "$lockdir" 2>/dev/null; do
        sleep $((RANDOM % 5 + 1))
    done

    # Lock acquired
    echo "Job $SLURM_ARRAY_TASK_ID pushing..."
    git pull --rebase
    git push

    # Release lock
    rmdir "$lockdir"
fi
