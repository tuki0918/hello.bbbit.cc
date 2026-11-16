#!/bin/sh
set -eu

cd "$(dirname "$0")"

rm -rf dist
mkdir dist
cp -R avatar*.webp favicon.svg og.png yuta-yamamoto.vcf fonts vendor dist/
node scripts/build.mjs
