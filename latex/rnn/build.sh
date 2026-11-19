#!/usr/bin/env bash
# Builds every figure in this folder into pdf/. Run from this folder: ./build.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p pdf
build() {  # build <output name> <figure file> [extra \def's]
  pdflatex -interaction=nonstopmode -halt-on-error -output-directory=pdf -jobname="$1" \
    "\def\rnnfig{$2}${3:-}\input{standalone.tex}" > /dev/null || { echo "failed: $1 (see pdf/$1.log)"; exit 1; }
  echo "pdf/$1.pdf"
}
build rnn-rolled          rnn-unrolled  '\def\rnnunrolled{rolled}'
build rnn-unrolled        rnn-unrolled  '\def\rnnunrolled{full}'
build rnn-short-term      rnn-unrolled  '\def\rnnunrolled{short}'
build rnn-long-term       rnn-unrolled  '\def\rnnunrolled{long}'
build rnn-chain           rnn-chain
build lstm-chain          lstm-chain
build lstm-notation       lstm-notation
build lstm-cell           lstm-cell
build lstm-cline          lstm-cell     '\def\rnnfocus{cline}'
build lstm-gate           lstm-gate
build lstm-focus-f        lstm-cell     '\def\rnnfocus{f}'
build lstm-focus-i        lstm-cell     '\def\rnnfocus{i}'
build lstm-focus-c        lstm-cell     '\def\rnnfocus{c}'
build lstm-focus-o        lstm-cell     '\def\rnnfocus{o}'
build lstm-peephole       lstm-cell     '\def\rnnvariant{peephole}'
build lstm-coupled        lstm-cell     '\def\rnnvariant{coupled}'
build gru-cell            gru-cell
rm -f pdf/*.aux pdf/*.log
