#!/bin/bash
# uso: cap.sh <pasta> [temas...]
cd /tmp/claude-0/-home-user-Dorf/428237ba-b457-5f52-95bd-57828975f58f/scratchpad/cores/wt
OUT=$1; shift
TH=${@:-holanda egito oriental brasil inverno}
Q="seed=7&auto=60&quality=high&timescale=0.05&zoom=12"
mkdir -p $OUT
args=()
for t in $TH; do for h in day dusk night; do args+=("$t-$h=theme=$t&$Q&time=$h"); done; args+=("$t-sil=theme=$t&$Q&time=day&silhueta"); done
W=1200 H=720 node scripts/.shot-4273.mjs $OUT "${args[@]}" 2>&1 | cut -c1-160
