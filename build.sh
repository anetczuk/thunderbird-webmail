#!/bin/bash


SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null && pwd )"


src_dir=$SCRIPT_DIR/src
build_dir=$SCRIPT_DIR/build


pushd $build_dir > /dev/null


function zipbuild { 
	local dirpath=$1
    local dirname=$(basename "$dirpath")
    local outputfile="$build_dir/$dirname.xpi"
    echo "building $outputfile"
    
	pushd $dirpath > /dev/null
	zip -q -r $outputfile *
	popd > /dev/null
}

function antbuild { 
	local dirpath=$1
	local buildfile=$dirpath/build.xml
	if [ -e $buildfile ]; then
	    ant -f $buildfile
	    echo -e "\n"
	else
		echo -e "Could not find buid file: $buildfile\n\n"
	fi
}



if [ "$#" -lt 1 ]; then
	#for dirpath in $src_dir/*; do
	for dirpath in $(find $src_dir/* -maxdepth 0 -type d); do
	    ## echo "building $dirpath"
	
		#### use build script
		antbuild $dirpath
	    
	    #### simply zip
		##zipbuild $dirpath
	done
else
	addon=$1
	dirpath=$src_dir/$addon
	if [ ! -d "$dirpath" ]; then
		echo "No addon found: $dirpath"
		exit 1
	fi
	
	#### use build script
	antbuild $dirpath
    
    #### simply zip
	##zipbuild $dirpath	
fi

popd > /dev/null
