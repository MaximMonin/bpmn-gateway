#!/bin/bash

docker pull williamyeh/wrk

myip=$(hostname -I | cut -d' ' -f1)
# run 100 connections within 10 threads during 10 seconds (spam start process)
docker run --rm -v `pwd`:/data williamyeh/wrk -s post.lua -t10 -c100 -d10s http://$myip:2700/camunda/process/payment-retrieval/start
