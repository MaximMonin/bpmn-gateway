#!/bin/bash

curl -H "Content-Type: multipart/form-data" -X POST -F 'upload=@"./camunda-test.bpmn"' http://localhost:2700/camunda/deployment/payment-retrieval/create
