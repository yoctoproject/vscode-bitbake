#!/bin/bash

FILE="scripts/fetch-docs.sh"
TMP_FILE="tmp.txt"
tail -n +8 $FILE > $TMP_FILE

echo "#!/bin/bash" > $FILE
echo "" >> $FILE

git clone --depth 1 --filter=blob:none --sparse https://github.com/openembedded/bitbake.git
cd bitbake
git fetch --tags
TMP_TAG=$(git tag | tail -n 1)
LASTEST_RELEASE=$(git show $TMP_TAG | grep commit | sed "s/^commit //")
echo "# Tag: $TMP_TAG" >> ../$FILE
echo "BITBAKE_DOCS_COMMIT=$LASTEST_RELEASE" >> ../$FILE
cd ..
rm -rf bitbake

git clone --depth 1 --filter=blob:none --sparse https://git.yoctoproject.org/yocto-docs
cd yocto-docs
git fetch --tags
TMP_TAG=$(git tag | tail -n 1)
LASTEST_RELEASE=$(git show $TMP_TAG | grep commit | sed "s/^commit //")
echo "# Tag: $TMP_TAG" >> ../$FILE
echo "YOCTO_DOCS_COMMIT=$LASTEST_RELEASE" >> ../$FILE
echo "" >> ../$FILE
cd ..
rm -rf yocto-docs

cat $TMP_FILE >> $FILE
rm $TMP_FILE