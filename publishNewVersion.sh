#!/bin/sh
set -e
CWD="$(pwd)"
cd "$(dirname $0)"

yarn rebuild
yarn lint
yarn prettier:check

VERSIONTYPE="${1:-patch}"
npm version --preid pre ${VERSIONTYPE} -m "release version %s"
case ${VERSIONTYPE} in
	"pre"*) npm publish --tag next ;;
	*) npm publish ;;
esac
cd "$CWD"
