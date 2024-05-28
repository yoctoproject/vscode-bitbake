#!/bin/bash -ex

# Update the fetch-poky.sh script
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

# Update the version.ts
DEST="integration-tests/src/utils/version.ts"

# Keep the header
TOTAL_LINES=$(wc -l < $DEST)
LINES_TO_KEEP=$(($TOTAL_LINES - 2))
TMP="tmp.ts"
head -n $LINES_TO_KEEP $DEST > $TMP

git clone --depth 1 --filter=blob:none --sparse https://github.com/bash-lsp/bash-language-server
cd bash-language-server
git fetch --tags
echo "export const bashVersion = '$(git tag --sort=-v:refname | head -n 1 | sed "s/^vscode-client-//")'" >> ../$TMP
cd ..
rm -rf bash-language-server

git clone --depth 1 --filter=blob:none --sparse https://github.com/Microsoft/vscode-python
cd vscode-python
git fetch --tags
echo "export const pythonVersion = '$(git tag --sort=-v:refname | head -n 1 | sed "s/^v//")'" >> ../$TMP
cd ..
rm -rf vscode-python

cp $TMP $DEST
rm $TMP

# Update the fetch-docs.sh script
FILE="scripts/fetch-docs.sh"
TMP_FILE="tmp.txt"
tail -n +8 $FILE > $TMP_FILE

echo "#!/bin/bash" > $FILE
echo "" >> $FILE

git clone --depth 1 --filter=blob:none --sparse https://github.com/openembedded/bitbake.git
cd bitbake
git fetch --tags
TMP_TAG=$(git tag --sort=-v:refname | head -n 1)
LASTEST_RELEASE=$(git show $TMP_TAG | grep commit | sed "s/^commit //")
echo "# Tag: $TMP_TAG" >> ../$FILE
echo "BITBAKE_DOCS_COMMIT=$LASTEST_RELEASE" >> ../$FILE
cd ..
rm -rf bitbake

git clone --depth 1 --filter=blob:none --sparse https://git.yoctoproject.org/yocto-docs
cd yocto-docs
git fetch --tags
TMP_TAG=$(git tag --sort=-v:refname | head -n 1)
LASTEST_RELEASE=$(git show $TMP_TAG | grep commit | sed "s/^commit //")
echo "# Tag: $TMP_TAG" >> ../$FILE
echo "YOCTO_DOCS_COMMIT=$LASTEST_RELEASE" >> ../$FILE
echo "" >> ../$FILE
cd ..
rm -rf yocto-docs

git clone --depth 1 --filter=blob:none --sparse https://github.com/microsoft/vscode.git
cd vscode
git fetch --tags
TMP_TAG=$(git tag --sort=-v:refname | grep -E '^[0-9.]+$' | head -n 1)
sed -e "s/vscodeVersion = '.*'/vscodeVersion = '$TMP_TAG'/" -i ../integration-tests/src/runTest.ts
cd ..
rm -rf vscode

cat $TMP_FILE >> $FILE
rm $TMP_FILE
