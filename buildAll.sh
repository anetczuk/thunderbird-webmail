#!/bin/bash


SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"


src_dir=$SCRIPT_DIR/src
build_dir=$SCRIPT_DIR/build


#for dirpath in $src_dir/*; do
for dirpath in $(find $src_dir/* -maxdepth 0 -type d); do
    ## echo "building $dirpath"
    dirname=$(basename "$dirpath")
    outputfile="$build_dir/$dirname.xpi"
    echo "building $outputfile"
    
	pushd $dirpath > /dev/null
	zip -q -r $outputfile *
	popd > /dev/null
done

