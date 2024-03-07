#!/bin/bash

FILE="scripts/fetch-poky.sh"
TMP_FILE="tmp.txt"
tail -n +6 $FILE > $TMP_FILE

echo "#!/bin/bash" > $FILE
echo "" >> $FILE

git clone --depth 1 --filter=blob:none --sparse https://github.com/yoctoproject/poky.git
cd poky
git fetch --tags
TMP_TAG=$(git tag | grep "yocto-" | tail -n 1) # There is a tag: yocto_1.5_M5.rc8 which will take the tail, thus adding a hyphen
LASTEST_RELEASE=$(git show $TMP_TAG | grep commit | sed "s/^commit //")
echo "# Tag: $TMP_TAG" >> ../$FILE
echo "COMMIT=$LASTEST_RELEASE" >> ../$FILE
echo "" >> ../$FILE
cd ..
rm -rf poky

cat $TMP_FILE >> $FILE
rm $TMP_FILE