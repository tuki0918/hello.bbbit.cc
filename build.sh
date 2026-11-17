#!/bin/sh
set -eu

cd "$(dirname "$0")"

rm -rf dist
mkdir dist
cp -R avatar*.svg favicon.svg og.png fonts vendor dist/
node scripts/build.mjs
