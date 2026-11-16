#!/bin/sh
set -eu

cd "$(dirname "$0")"

rm -rf dist
mkdir dist
cp -R index.html style.css main.js avatar.webp favicon.svg og.png yuta-yamamoto.vcf vendor dist/
