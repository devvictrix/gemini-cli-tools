npm run dev -- run-k6 src/k6/data/happy-path-tests.csv \
  --output ./src/k6/results \
  --summaryFormat csv \
  --summaryCsv ./src/k6/results/powerful_summary.csv \
  --mock