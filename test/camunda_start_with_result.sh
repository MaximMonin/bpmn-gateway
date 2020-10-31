#!/bin/bash

for (( i=0; i<100; ++i)); do
  curl -H "Content-Type: application/json" -X POST -d '{"timeout": 1000, "variables": {"amount": {"value":555,"type":"long"}, "item": {"value":"item-xyz"} } }' http://localhost:2700/camunda/process/payment-retrieval/start/withresult
done