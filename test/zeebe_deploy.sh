#!/bin/bash

curl -H "Content-Type: multipart/form-data" -X POST -F 'upload=@"./zeebe-test.bpmn"' http://localhost:2700/zeebe/deployment/payment-retrieval/create
