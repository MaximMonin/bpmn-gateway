#!/bin/bash

for (( i=0; i<100; ++i)); do
  curl -H "Content-Type: application/json" -X POST -d '{"variables": {"amount": {"value":555,"type":"long"}, "item": {"value":"item-xyz"} } }' http://localhost:2700/camunda/message/payment-retrieval-start/publish
done
