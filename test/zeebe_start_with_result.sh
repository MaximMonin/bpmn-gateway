#!/bin/bash

for (( i=0; i<100; ++i)); do
  curl -H "Content-Type: application/json" -X POST -d '{"variables": {"amount": 555, "item": "item-xyz" } }' http://localhost:2700/zeebe/process/payment-retrieval/start/withresult
done